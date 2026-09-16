import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, Loader2, CheckCircle2, ArrowRight } from "lucide-react";
import type { RwaTokenConfig } from "@/config/rwaTokens";
import {
  type RwaMarketOverview,
  type SellQuote,
  type BuyQuote,
  calculateBuyQuote,
  calculateBuyQuoteFromPayoutAmount,
  calculateSellQuote,
  buildBuyTransaction,
  buildSellTransaction,
  buildSwapAndBuyTransaction,
  fetchJupiterExchangeRate,
  fetchJupiterQuote,
  type JupiterQuoteResponse,
  getGetEquityConnection,
  KNOWN_PAYOUT_MINTS,
} from "@/services/getEquityService";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";

export interface SolanaWalletLike {
  address?: string;
  getAddress?: () => Promise<string>;
}

export type SignTransactionFn = (args: {
  transaction: Uint8Array;
  wallet?: unknown;
}) => Promise<{ signedTransaction?: Uint8Array } | Uint8Array>;

interface RwaTradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  direction: "buy" | "sell";
  tokenConfig: RwaTokenConfig;
  marketOverview: RwaMarketOverview | null;
  usdcBalance: number | null;
  cngnBalance?: number | null;
  userShares: number | null;
  solanaWallet: SolanaWalletLike | null | undefined;
  signTransaction: SignTransactionFn | null | undefined;
  onTradeSuccess: () => void;
  initialAmount?: string;
}

export default function RwaTradeDialog({
  open,
  onOpenChange,
  direction,
  tokenConfig,
  marketOverview,
  usdcBalance,
  cngnBalance,
  userShares,
  solanaWallet,
  signTransaction,
  onTradeSuccess,
  initialAmount,
}: RwaTradeDialogProps) {
  const { toast } = useToast();
  const isBuy = direction === "buy";
  const isCngnSettled = tokenConfig.payoutSymbol === "cNGN";

  // Payment method: "USDC" (swap via Jupiter/Orca) or "cNGN" (direct)
  const [paymentToken, setPaymentToken] = useState<"USDC" | "cNGN">(
    isCngnSettled ? "USDC" : "cNGN"
  );

  // Buy mode: "usdc" (spend budget) or "shares" (exact DPRI shares)
  const [buyMode, setBuyMode] = useState<"usdc" | "shares">("usdc");
  const [inputValue, setInputValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Jupiter live quote & rate state
  const [jupRate, setJupRate] = useState<number>(1368.95);
  const [jupRateLoading, setJupRateLoading] = useState<boolean>(false);
  const [jupQuoteLoading, setJupQuoteLoading] = useState<boolean>(false);
  const [, setLiveJupQuote] = useState<JupiterQuoteResponse | null>(null);
  const [estimatedUsdcCost, setEstimatedUsdcCost] = useState<number>(0);
  const [estimatedShares, setEstimatedShares] = useState<number>(0);
  const [estimatedCngnProceeds, setEstimatedCngnProceeds] = useState<number>(0);

  // Active user balance depending on selected payment method
  const activeSpendBalance = useMemo(() => {
    if (paymentToken === "USDC") {
      return usdcBalance;
    }
    return cngnBalance !== null && cngnBalance !== undefined ? cngnBalance : usdcBalance;
  }, [paymentToken, usdcBalance, cngnBalance]);

  // Fetch live Jupiter exchange rate (USDC -> cNGN)
  const refreshJupiterRate = useCallback(async () => {
    if (!isCngnSettled) return;
    try {
      setJupRateLoading(true);
      const res = await fetchJupiterExchangeRate(
        KNOWN_PAYOUT_MINTS.mainnet.USDC,
        tokenConfig.payoutMint
      );
      if (res.rate > 0) {
        setJupRate(res.rate);
      }
    } catch (err) {
      console.warn("[RwaTradeDialog] Error fetching Jupiter rate:", err);
    } finally {
      setJupRateLoading(false);
    }
  }, [isCngnSettled, tokenConfig.payoutMint]);

  // Reset or initialize state when opening
  useEffect(() => {
    if (open) {
      setInputValue(initialAmount || "");
      setTxSignature(null);
      setErrorMessage(null);
      setSubmitting(false);
      setBuyMode("usdc");
      setPaymentToken(isCngnSettled ? "USDC" : "cNGN");
      void refreshJupiterRate();
    }
  }, [open, direction, initialAmount, isCngnSettled, refreshJupiterRate]);

  const parsedValue = useMemo(() => {
    const val = parseFloat(inputValue);
    return isNaN(val) || val <= 0 ? 0 : val;
  }, [inputValue]);

  const currSymbol = isBuy && paymentToken === "USDC" ? "$" : (tokenConfig.payoutSymbol === "cNGN" ? "₦" : "$");

  // Standard GetEquity direct calculation (used for direct cNGN buy and sell)
  const standardQuote = useMemo<BuyQuote | SellQuote | null>(() => {
    if (!marketOverview?.asset || parsedValue <= 0) return null;
    const rwaDecimals = tokenConfig.decimals || 6;
    const payoutDecimals = tokenConfig.payoutDecimals || 6;

    if (isBuy) {
      if (buyMode === "usdc") {
        return calculateBuyQuoteFromPayoutAmount({
          payoutAmount: parsedValue,
          asset: marketOverview.asset,
          rwaDecimals,
          payoutDecimals,
          slippageBps: 50,
        });
      } else {
        return calculateBuyQuote({
          amount: parsedValue,
          asset: marketOverview.asset,
          rwaDecimals,
          payoutDecimals,
          slippageBps: 50,
        });
      }
    } else {
      return calculateSellQuote({
        amount: parsedValue,
        asset: marketOverview.asset,
        rwaDecimals,
        payoutDecimals,
        slippageBps: 50,
      });
    }
  }, [marketOverview, parsedValue, isBuy, buyMode, tokenConfig]);

  // Real-time live Jupiter quote calculation when paying with USDC
  useEffect(() => {
    let active = true;
    if (!isBuy || paymentToken !== "USDC" || !isCngnSettled || parsedValue <= 0 || !marketOverview?.asset) {
      setLiveJupQuote(null);
      setEstimatedUsdcCost(0);
      setEstimatedShares(0);
      setEstimatedCngnProceeds(0);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setJupQuoteLoading(true);
        const usdcMint = KNOWN_PAYOUT_MINTS.mainnet.USDC;
        const cngnMint = tokenConfig.payoutMint;

        if (buyMode === "usdc") {
          // Fixed USDC budget
          const usdcUnits = BigInt(Math.round(parsedValue * 1e6));
          const q = await fetchJupiterQuote({
            inputMint: usdcMint,
            outputMint: cngnMint,
            amountUnits: usdcUnits,
            slippageBps: 100,
          });
          if (!active) return;

          setLiveJupQuote(q);
          const minCngnDisplay = Number(q.otherAmountThreshold || q.outAmount) / 1e6;
          const bQuote = calculateBuyQuoteFromPayoutAmount({
            payoutAmount: minCngnDisplay,
            asset: marketOverview.asset,
            rwaDecimals: 6,
            payoutDecimals: 6,
            slippageBps: 100,
          });
          setEstimatedShares(bQuote.amountDisplay);
          setEstimatedUsdcCost(parsedValue);
          setEstimatedCngnProceeds(Number(q.outAmount) / 1e6);
        } else {
          // Exact DPRI shares
          const bQuote = calculateBuyQuote({
            amount: parsedValue,
            asset: marketOverview.asset,
            rwaDecimals: 6,
            payoutDecimals: 6,
            slippageBps: 100,
          });

          // Estimate required USDC from live rate with buffer
          const targetCngnUnits = Number(bQuote.maxCostUnits);
          let estimatedUsdcUnits = Math.ceil((targetCngnUnits / (jupRate * 1e6)) * 1e6 * 1.008);

          let q = await fetchJupiterQuote({
            inputMint: usdcMint,
            outputMint: cngnMint,
            amountUnits: estimatedUsdcUnits,
            slippageBps: 100,
          });

          if (BigInt(q.otherAmountThreshold) < bQuote.maxCostUnits) {
            estimatedUsdcUnits = Math.ceil(estimatedUsdcUnits * 1.015);
            q = await fetchJupiterQuote({
              inputMint: usdcMint,
              outputMint: cngnMint,
              amountUnits: estimatedUsdcUnits,
              slippageBps: 100,
            });
          }

          if (!active) return;
          setLiveJupQuote(q);
          setEstimatedUsdcCost(Number(q.inAmount) / 1e6);
          setEstimatedShares(parsedValue);
          setEstimatedCngnProceeds(Number(q.outAmount) / 1e6);
        }
      } catch (err) {
        console.warn("[RwaTradeDialog] Live quote error:", err);
      } finally {
        if (active) setJupQuoteLoading(false);
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [isBuy, paymentToken, isCngnSettled, parsedValue, buyMode, marketOverview?.asset, jupRate, tokenConfig.payoutMint]);

  // Input validation
  const validationError = useMemo(() => {
    if (parsedValue <= 0) return null;
    const minPayoutCost = tokenConfig.minBuyCostPayout ?? (isCngnSettled ? 5250 : 0);
    const minShares = tokenConfig.minBuyShares ?? (isCngnSettled ? 10 : 0);
    const minUsdcCost = jupRate > 0 ? minPayoutCost / jupRate : minPayoutCost / 1368.95;

    if (isBuy) {
      // 1. Enforce Minimum Purchase Rule (5,250 cNGN equivalent)
      if (minPayoutCost > 0) {
        if (paymentToken === "USDC") {
          if (buyMode === "usdc" && parsedValue < minUsdcCost * 0.99) {
            return `Minimum purchase is ~$${minUsdcCost.toFixed(2)} USDC (₦${minPayoutCost.toLocaleString()} ${tokenConfig.payoutSymbol} equivalent, ~${minShares} ${tokenConfig.symbol}).`;
          }
          if (buyMode === "shares" && parsedValue < minShares) {
            return `Minimum purchase is ${minShares} ${tokenConfig.symbol} (≈ ₦${minPayoutCost.toLocaleString()} ${tokenConfig.payoutSymbol}, ~$${minUsdcCost.toFixed(2)} USDC).`;
          }
        } else {
          if (buyMode === "usdc" && parsedValue < minPayoutCost) {
            return `Minimum purchase is ₦${minPayoutCost.toLocaleString()} ${tokenConfig.payoutSymbol} (~${minShares} ${tokenConfig.symbol}).`;
          }
          if (buyMode === "shares" && parsedValue < minShares) {
            return `Minimum purchase is ${minShares} ${tokenConfig.symbol} (≈ ₦${minPayoutCost.toLocaleString()} ${tokenConfig.payoutSymbol}).`;
          }
        }
      }

      // 2. Balance Validation
      if (paymentToken === "USDC") {
        if (usdcBalance !== null) {
          const cost = buyMode === "usdc" ? parsedValue : (estimatedUsdcCost > 0 ? estimatedUsdcCost : (parsedValue * (marketOverview?.asset?.priceUSD || 525) / jupRate));
          if (cost > usdcBalance) {
            return `Insufficient USDC balance. You have ${usdcBalance.toFixed(2)} USDC, need ~${cost.toFixed(2)} USDC.`;
          }
        }
        if (buyMode === "usdc" && estimatedShares <= 0 && !jupQuoteLoading) {
          return `USDC amount is too low to purchase minimum ${tokenConfig.symbol} shares.`;
        }
      } else {
        // Direct cNGN
        const spendBal = cngnBalance !== null && cngnBalance !== undefined ? cngnBalance : usdcBalance;
        if (buyMode === "usdc") {
          if (spendBal !== null && parsedValue > spendBal) {
            return `Insufficient ${tokenConfig.payoutSymbol} balance. You have ${spendBal.toFixed(2)} ${tokenConfig.payoutSymbol}.`;
          }
          if (standardQuote && (standardQuote as BuyQuote).amountUnits <= 0n) {
            return `Amount is too low to purchase minimum ${tokenConfig.symbol} shares.`;
          }
        } else {
          if (standardQuote && spendBal !== null && (standardQuote as BuyQuote).totalCostUSD > spendBal) {
            return `Insufficient ${tokenConfig.payoutSymbol} balance. You have ${spendBal.toFixed(2)} ${tokenConfig.payoutSymbol}.`;
          }
        }
      }
    } else {
      if (userShares !== null && parsedValue > userShares) {
        return `Insufficient shares. You hold ${userShares.toFixed(4)} ${tokenConfig.symbol}.`;
      }
    }
    return null;
  }, [
    parsedValue,
    isBuy,
    paymentToken,
    buyMode,
    usdcBalance,
    cngnBalance,
    estimatedUsdcCost,
    estimatedShares,
    jupQuoteLoading,
    standardQuote,
    userShares,
    tokenConfig,
    marketOverview?.asset?.priceUSD,
    jupRate,
    isCngnSettled,
  ]);

  const handleMin = () => {
    const minPayout = tokenConfig.minBuyCostPayout ?? 5250;
    const minShares = tokenConfig.minBuyShares ?? 10;
    if (buyMode === "usdc") {
      if (paymentToken === "USDC") {
        const estUsdc = minPayout / (jupRate > 0 ? jupRate : 1368.95);
        setInputValue((Math.ceil(estUsdc * 100) / 100).toFixed(2));
      } else {
        setInputValue(String(minPayout));
      }
    } else {
      setInputValue(String(minShares));
    }
  };

  const handleMax = () => {
    if (isBuy) {
      if (paymentToken === "USDC") {
        if (!usdcBalance || usdcBalance <= 0) return;
        if (buyMode === "usdc") {
          setInputValue(String(usdcBalance));
        } else {
          // Estimate max shares from USDC
          const unitPriceCngn = marketOverview?.asset ? Number(marketOverview.asset.priceCents) / 100 : 525;
          const feeFactor = 1 + (marketOverview?.asset?.feePercent || 1) / 100;
          const cngnEquiv = usdcBalance * jupRate;
          const maxShares = Math.floor((cngnEquiv / (unitPriceCngn * feeFactor)) * 1000) / 1000;
          if (maxShares > 0) setInputValue(String(maxShares));
        }
      } else {
        const spendBal = cngnBalance !== null && cngnBalance !== undefined ? cngnBalance : usdcBalance;
        if (!spendBal || !marketOverview?.asset) return;
        if (buyMode === "usdc") {
          setInputValue(String(spendBal));
        } else {
          const unitPrice = marketOverview.asset.priceUSD;
          const feeFactor = 1 + marketOverview.asset.feePercent / 100;
          const maxShares = Math.floor((spendBal / (unitPrice * feeFactor)) * 1000) / 1000;
          if (maxShares > 0) {
            setInputValue(String(maxShares));
          }
        }
      }
    } else {
      if (userShares && userShares > 0) {
        setInputValue(String(userShares));
      }
    }
  };

  const handleExecute = async () => {
    if (parsedValue <= 0 || !solanaWallet) return;
    setErrorMessage(null);
    setSubmitting(true);

    try {
      const connection = getGetEquityConnection(tokenConfig.cluster);
      let traderPubkey: PublicKey;

      if (solanaWallet.address) {
        traderPubkey = new PublicKey(solanaWallet.address);
      } else if (typeof solanaWallet.getAddress === "function") {
        const addr = await solanaWallet.getAddress();
        traderPubkey = new PublicKey(addr);
      } else {
        throw new Error("Could not resolve your Solana wallet address.");
      }

      const mintPubkey = new PublicKey(tokenConfig.mint);

      if (!signTransaction) {
        throw new Error("Privy transaction signer is not available. Please reconnect your wallet.");
      }

      let tx: Transaction | VersionedTransaction;
      let finalSharesDisplay = 0;

      if (isBuy && paymentToken === "USDC" && isCngnSettled) {
        // Atomic Jupiter Swap (USDC -> cNGN) + GetEquity Buy (cNGN -> DPRI)
        const swapRes = await buildSwapAndBuyTransaction({
          connection,
          trader: traderPubkey,
          mint: mintPubkey,
          spendMode: buyMode,
          inputValue: parsedValue,
          slippageBps: 100,
        });
        tx = swapRes.versionedTransaction;
        finalSharesDisplay = swapRes.estimatedShares;
      } else if (isBuy) {
        // Direct cNGN Buy
        if (!standardQuote) throw new Error("Quote is not available.");
        const buyRes = await buildBuyTransaction({
          connection,
          trader: traderPubkey,
          mint: mintPubkey,
          amountUnits: (standardQuote as BuyQuote).amountUnits,
          slippageBps: standardQuote.slippageBps,
        });
        tx = buyRes.transaction;
        finalSharesDisplay = standardQuote.amountDisplay;
      } else {
        // Direct Sell
        if (!standardQuote) throw new Error("Quote is not available.");
        const sellRes = await buildSellTransaction({
          connection,
          trader: traderPubkey,
          mint: mintPubkey,
          amountUnits: (standardQuote as SellQuote).amountUnits,
          slippageBps: standardQuote.slippageBps,
        });
        tx = sellRes.transaction;
        finalSharesDisplay = standardQuote.amountDisplay;
      }

      // Serialize (handles both VersionedTransaction and legacy Transaction)
      const serializedBytes: Uint8Array =
        "version" in tx
          ? (tx as VersionedTransaction).serialize()
          : (tx as Transaction).serialize({ requireAllSignatures: false });

      // Sign with Privy wallet
      const signRes = await signTransaction({
        transaction: serializedBytes,
        wallet: solanaWallet,
      });

      const signedBytes: Uint8Array =
        signRes && "signedTransaction" in signRes && signRes.signedTransaction
          ? signRes.signedTransaction
          : (signRes as Uint8Array);

      // Broadcast to Solana
      const txid = await connection.sendRawTransaction(signedBytes, {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });

      // Confirm transaction
      const confirmation = await connection.confirmTransaction(txid, "confirmed");
      if (confirmation.value.err) {
        throw new Error(`Transaction failed on-chain: ${JSON.stringify(confirmation.value.err)}`);
      }

      setTxSignature(txid);
      toast({
        title: isBuy ? "Buy Order Completed" : "Sell Order Completed",
        description: isBuy && paymentToken === "USDC"
          ? `Successfully swapped USDC to cNGN and bought ${finalSharesDisplay.toFixed(4)} ${tokenConfig.symbol}!`
          : `Successfully ${isBuy ? "bought" : "sold"} ${finalSharesDisplay.toFixed(4)} ${tokenConfig.symbol}!`,
      });

      onTradeSuccess();
    } catch (err: unknown) {
      console.error("[RwaTradeDialog] Trade error:", err);
      let msg = err instanceof Error ? err.message : "Failed to execute transaction on Solana";
      if (msg.includes("custom program error: 0x1") || msg.includes("insufficient funds") || msg.includes("insufficient lamports")) {
        msg = paymentToken === "USDC"
          ? "Insufficient balance: Your connected wallet does not hold enough USDC or SOL (network fee) to complete this transaction."
          : `Insufficient balance: Your connected wallet does not hold enough ${tokenConfig.payoutSymbol} to complete this trade.`;
      }
      setErrorMessage(msg);
      toast({
        title: "Trade Failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const clusterParam = tokenConfig.cluster === "devnet" ? "?cluster=devnet" : "";
  const explorerUrl = txSignature ? `https://solscan.io/tx/${txSignature}${clusterParam}` : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2.5">
            <Avatar className="w-7 h-7 rounded-lg border border-primary/20 bg-primary/10">
              <AvatarImage src={tokenConfig.icon} alt={tokenConfig.name} className="object-cover" />
              <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-xs font-bold">
                {tokenConfig.symbol.slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <span>{isBuy ? "Buy" : "Sell"} {tokenConfig.symbol}</span>
          </DialogTitle>
        </DialogHeader>

        {txSignature ? (
          <div className="space-y-4 py-4 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-lg">Transaction Confirmed</h3>
              <p className="text-sm text-muted-foreground">
                Your order has settled on the Solana blockchain.
              </p>
            </div>
            {explorerUrl && (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <span>View on Solscan</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <Button
              className="w-full rounded-full mt-4"
              onClick={() => onOpenChange(false)}
            >
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Payment Method Selector (USDC vs cNGN) for DPRI */}
            {isBuy && isCngnSettled && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 pb-0.5">
                  <span className="text-xs text-muted-foreground font-medium">Pay with</span>
                  <div className="inline-flex rounded-lg bg-secondary/80 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentToken("USDC");
                        setInputValue("");
                      }}
                      className={`px-3 py-1 rounded-md font-medium transition-all ${
                        paymentToken === "USDC"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span>USDC (Auto-Swap)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentToken("cNGN");
                        setInputValue("");
                      }}
                      className={`px-3 py-1 rounded-md font-medium transition-all ${
                        paymentToken === "cNGN"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      cNGN (Direct)
                    </button>
                  </div>
                </div>

                {paymentToken === "USDC" && (
                  <div className="rounded-xl bg-primary/5 border border-primary/20 p-2.5 text-[11px] flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="font-semibold text-foreground">Route:</span>
                      <span>USDC</span>
                      <ArrowRight className="w-3 h-3 text-primary" />
                      <span>cNGN (Orca)</span>
                      <ArrowRight className="w-3 h-3 text-primary" />
                      <span>DPRI</span>
                    </div>
                    <div className="font-semibold text-primary">
                      {jupRateLoading ? (
                        <Loader2 className="w-3 h-3 animate-spin inline" />
                      ) : (
                        `1 USDC ≈ ₦${jupRate.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Input Mode Selector for Buy (Spend Currency vs Exact Shares) */}
            {isBuy && (
              <div className="flex items-center justify-between gap-2 pb-1">
                <span className="text-xs text-muted-foreground font-medium">Input Type</span>
                <div className="inline-flex rounded-lg bg-secondary/80 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setBuyMode("usdc");
                      setInputValue("");
                    }}
                    className={`px-3 py-1 rounded-md font-medium transition-all ${
                      buyMode === "usdc"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Spend {paymentToken === "USDC" ? "USDC" : tokenConfig.payoutSymbol}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBuyMode("shares");
                      setInputValue("");
                    }}
                    className={`px-3 py-1 rounded-md font-medium transition-all ${
                      buyMode === "shares"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Exact {tokenConfig.symbol}
                  </button>
                </div>
              </div>
            )}

            <div className="text-sm text-muted-foreground flex items-center justify-between">
              <span>
                {isBuy
                  ? buyMode === "usdc"
                    ? `Amount to Invest (${paymentToken === "USDC" ? "USDC" : tokenConfig.payoutSymbol})`
                    : `Shares to Buy (${tokenConfig.symbol})`
                  : `Shares to Sell (${tokenConfig.symbol})`}
              </span>
              <span className="text-xs">
                Available:{" "}
                <span className="font-semibold text-foreground">
                  {isBuy
                    ? `${activeSpendBalance !== null && activeSpendBalance !== undefined ? activeSpendBalance.toFixed(2) : "0.00"} ${paymentToken === "USDC" ? "USDC" : tokenConfig.payoutSymbol}`
                    : `${userShares !== null ? userShares.toFixed(4) : "0.00"} ${tokenConfig.symbol}`}
                </span>
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="relative">
                <Input
                  type="number"
                  min="0.001"
                  step={isBuy && buyMode === "usdc" ? "0.1" : "0.001"}
                  placeholder={
                    isBuy
                      ? buyMode === "usdc"
                        ? paymentToken === "USDC"
                          ? (5250 / jupRate).toFixed(2)
                          : "5250"
                        : "10"
                      : "0.00"
                  }
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className="pr-28 text-lg font-medium"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                  {isBuy && (tokenConfig.minBuyCostPayout || isCngnSettled) && (
                    <button
                      type="button"
                      onClick={handleMin}
                      className="text-xs font-semibold px-2 py-1 rounded bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
                      title="Set minimum purchase"
                    >
                      MIN
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleMax}
                    className="text-xs font-semibold px-2 py-1 rounded bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    MAX
                  </button>
                  <span className="text-xs font-bold text-muted-foreground pr-1">
                    {isBuy
                      ? buyMode === "usdc"
                        ? paymentToken === "USDC" ? "USDC" : tokenConfig.payoutSymbol
                        : tokenConfig.symbol
                      : tokenConfig.symbol}
                  </span>
                </div>
              </div>

              {/* Min Order Notice */}
              {isBuy && (tokenConfig.minBuyCostPayout || isCngnSettled) && (
                <div className="flex items-center justify-between text-[11px] text-muted-foreground px-0.5">
                  <span>Min. Order Required:</span>
                  <span className="font-semibold text-foreground">
                    {paymentToken === "USDC"
                      ? `~$${(5250 / jupRate).toFixed(2)} USDC (₦5,250 cNGN · 10 ${tokenConfig.symbol})`
                      : `₦5,250 cNGN (10 ${tokenConfig.symbol})`}
                  </span>
                </div>
              )}

              {/* Real-time conversion preview */}
              {parsedValue > 0 && (
                <div className="flex items-center justify-between text-xs px-1 text-muted-foreground">
                  <span>
                    {isBuy
                      ? buyMode === "usdc"
                        ? "≈ You will receive:"
                        : "≈ Estimated Total Cost:"
                      : "≈ Estimated Net Proceeds:"}
                  </span>
                  <span className="font-semibold text-foreground flex items-center gap-1">
                    {jupQuoteLoading && <Loader2 className="w-3 h-3 animate-spin inline" />}
                    {isBuy ? (
                      paymentToken === "USDC" ? (
                        buyMode === "usdc" ? (
                          `${estimatedShares.toFixed(4)} ${tokenConfig.symbol}`
                        ) : (
                          `$${estimatedUsdcCost.toFixed(2)} USDC`
                        )
                      ) : buyMode === "usdc" && standardQuote ? (
                        `${standardQuote.amountDisplay.toFixed(4)} ${tokenConfig.symbol}`
                      ) : standardQuote ? (
                        `${currSymbol}${(standardQuote as BuyQuote).totalCostUSD.toFixed(2)} ${tokenConfig.payoutSymbol}`
                      ) : null
                    ) : standardQuote ? (
                      `${currSymbol}${(standardQuote as SellQuote).netProceedsUSD.toFixed(2)} ${tokenConfig.payoutSymbol}`
                    ) : null}
                  </span>
                </div>
              )}
            </div>

            {/* Quote details breakdown */}
            {((isBuy && paymentToken === "USDC" && parsedValue > 0) || standardQuote) && (
              <div className="rounded-xl bg-secondary/40 border border-border/60 p-3.5 text-xs space-y-2">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>{isBuy ? "Estimated Shares" : "Shares Sold"}</span>
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    {tokenConfig.icon && (
                      <img
                        src={tokenConfig.icon}
                        alt={tokenConfig.symbol}
                        className="w-4 h-4 rounded-full object-cover inline-block"
                      />
                    )}
                    <span>
                      {isBuy && paymentToken === "USDC"
                        ? `${estimatedShares.toFixed(4)} ${tokenConfig.symbol}`
                        : `${standardQuote?.amountDisplay.toFixed(4) || "0.0000"} ${tokenConfig.symbol}`}
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>DPRI Unit Price</span>
                  <span className="font-medium text-foreground">
                    ₦{((marketOverview?.asset ? Number(marketOverview.asset.priceCents) / 100 : 525)).toLocaleString(undefined, { minimumFractionDigits: 2 })} cNGN
                  </span>
                </div>

                {isBuy && paymentToken === "USDC" && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>cNGN Swapped via Jupiter</span>
                    <span className="font-medium text-foreground">
                      ₦{estimatedCngnProceeds.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} cNGN
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Protocol Fee ({marketOverview?.asset?.feePercent ?? 1.0}%)</span>
                  <span className="font-medium text-foreground">
                    {isBuy && paymentToken === "USDC"
                      ? `~₦${((estimatedCngnProceeds * (marketOverview?.asset?.feePercent || 1)) / 100).toFixed(2)} cNGN`
                      : `${currSymbol}${standardQuote?.feeUSD.toFixed(2) || "0.00"} ${tokenConfig.payoutSymbol}`}
                  </span>
                </div>

                <div className="border-t border-border/50 pt-2 flex items-center justify-between font-semibold text-sm">
                  <span>{isBuy ? "Total Cost" : "Net Proceeds"}</span>
                  <span className={isBuy ? "text-primary" : "text-emerald-500"}>
                    {isBuy && paymentToken === "USDC"
                      ? `$${estimatedUsdcCost.toFixed(2)} USDC`
                      : `${currSymbol}${(isBuy ? (standardQuote as BuyQuote)?.totalCostUSD : (standardQuote as SellQuote)?.netProceedsUSD)?.toFixed(2) || "0.00"} ${tokenConfig.payoutSymbol}`}
                  </span>
                </div>
              </div>
            )}

            {validationError && (
              <p className="text-xs text-destructive">{validationError}</p>
            )}

            {errorMessage && (
              <p className="text-xs text-destructive break-words">{errorMessage}</p>
            )}

            <Button
              type="button"
              className="w-full rounded-full font-semibold py-6"
              disabled={
                submitting ||
                parsedValue <= 0 ||
                jupQuoteLoading ||
                !!validationError ||
                !marketOverview?.asset?.isActive
              }
              onClick={handleExecute}
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isBuy && paymentToken === "USDC" ? "Executing Swap & Buy..." : "Submitting to Solana..."}</span>
                </span>
              ) : isBuy ? (
                paymentToken === "USDC" ? (
                  estimatedShares > 0 ? (
                    `Confirm Swap & Buy (~${estimatedShares.toFixed(4)} ${tokenConfig.symbol})`
                  ) : (
                    `Confirm Swap & Buy`
                  )
                ) : buyMode === "usdc" && standardQuote ? (
                  `Confirm Buy (~${standardQuote.amountDisplay.toFixed(4)} ${tokenConfig.symbol})`
                ) : (
                  `Confirm Buy (${parsedValue} ${tokenConfig.symbol})`
                )
              ) : (
                `Confirm Sell (${parsedValue} ${tokenConfig.symbol})`
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
