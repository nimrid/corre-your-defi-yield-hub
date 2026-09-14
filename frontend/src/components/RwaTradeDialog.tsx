import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, Loader2, CheckCircle2 } from "lucide-react";
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
  getGetEquityConnection,
} from "@/services/getEquityService";
import { PublicKey } from "@solana/web3.js";

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
  userShares,
  solanaWallet,
  signTransaction,
  onTradeSuccess,
  initialAmount,
}: RwaTradeDialogProps) {
  const { toast } = useToast();
  const isBuy = direction === "buy";

  // Buy mode: "usdc" (enter dollar amount to spend) or "shares" (enter DPRI shares)
  const [buyMode, setBuyMode] = useState<"usdc" | "shares">("usdc");
  const [inputValue, setInputValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset or initialize state when opening
  useEffect(() => {
    if (open) {
      setInputValue(initialAmount || "");
      setTxSignature(null);
      setErrorMessage(null);
      setSubmitting(false);
      setBuyMode("usdc");
    }
  }, [open, direction, initialAmount]);

  const parsedValue = useMemo(() => {
    const val = parseFloat(inputValue);
    return isNaN(val) || val <= 0 ? 0 : val;
  }, [inputValue]);

  const currSymbol = tokenConfig.payoutSymbol === "cNGN" ? "₦" : "$";

  // Real-time calculation using getEquityService trade math
  const quote = useMemo<BuyQuote | SellQuote | null>(() => {
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
          slippageBps: 50, // 0.5% default slippage
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

  // Input validation
  const validationError = useMemo(() => {
    if (parsedValue <= 0) return null;
    if (isBuy) {
      if (buyMode === "usdc") {
        if (usdcBalance !== null && parsedValue > usdcBalance) {
          return `Insufficient ${tokenConfig.payoutSymbol} balance. You have ${usdcBalance.toFixed(2)} ${tokenConfig.payoutSymbol}.`;
        }
        if (quote && (quote as BuyQuote).amountUnits <= 0n) {
          return `Amount is too low to purchase minimum ${tokenConfig.symbol} shares.`;
        }
      } else {
        if (quote && usdcBalance !== null && (quote as BuyQuote).totalCostUSD > usdcBalance) {
          return `Insufficient ${tokenConfig.payoutSymbol} balance. You have ${usdcBalance.toFixed(2)} ${tokenConfig.payoutSymbol}.`;
        }
      }
    } else {
      if (userShares !== null && parsedValue > userShares) {
        return `Insufficient shares. You hold ${userShares.toFixed(4)} ${tokenConfig.symbol}.`;
      }
    }
    return null;
  }, [parsedValue, isBuy, buyMode, quote, usdcBalance, userShares, tokenConfig]);

  const handleMax = () => {
    if (isBuy) {
      if (!usdcBalance || !marketOverview?.asset) return;
      if (buyMode === "usdc") {
        setInputValue(String(usdcBalance));
      } else {
        const unitPrice = marketOverview.asset.priceUSD;
        const feeFactor = 1 + marketOverview.asset.feePercent / 100;
        const maxShares = Math.floor((usdcBalance / (unitPrice * feeFactor)) * 1000) / 1000;
        if (maxShares > 0) {
          setInputValue(String(maxShares));
        }
      }
    } else {
      if (userShares && userShares > 0) {
        setInputValue(String(userShares));
      }
    }
  };

  const handleExecute = async () => {
    if (!quote || parsedValue <= 0 || !solanaWallet) return;
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

      let tx;
      if (isBuy) {
        const res = await buildBuyTransaction({
          connection,
          trader: traderPubkey,
          mint: mintPubkey,
          amountUnits: (quote as BuyQuote).amountUnits,
          slippageBps: quote.slippageBps,
        });
        tx = res.transaction;
      } else {
        const res = await buildSellTransaction({
          connection,
          trader: traderPubkey,
          mint: mintPubkey,
          amountUnits: (quote as SellQuote).amountUnits,
          slippageBps: quote.slippageBps,
        });
        tx = res.transaction;
      }

      if (!signTransaction) {
        throw new Error("Privy transaction signer is not available. Please reconnect your wallet.");
      }

      // Serialize and sign with Privy embedded wallet
      const serialized = tx.serialize({ requireAllSignatures: false });
      const signRes = await signTransaction({
        transaction: new Uint8Array(serialized),
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
        description: `Successfully ${isBuy ? "bought" : "sold"} ${quote.amountDisplay.toFixed(4)} ${tokenConfig.symbol}!`,
      });

      onTradeSuccess();
    } catch (err: unknown) {
      console.error("[RwaTradeDialog] Trade error:", err);
      let msg = err instanceof Error ? err.message : "Failed to execute transaction on Solana";
      if (msg.includes("custom program error: 0x1") || msg.includes("insufficient funds")) {
        msg = `Insufficient balance: Your connected wallet does not hold enough of the vault's settlement token (${tokenConfig.payoutSymbol}) to complete this trade.`;
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
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <span>{isBuy ? "Buy" : "Sell"} {tokenConfig.symbol}</span>
            <span className="text-xs font-normal text-muted-foreground uppercase px-2 py-0.5 rounded-full bg-secondary">
              GetEquity On-Chain
            </span>
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
            {/* Input Mode Selector for Buy (Spend USDC vs Exact Shares) */}
            {isBuy && (
              <div className="flex items-center justify-between gap-2 pb-1">
                <span className="text-xs text-muted-foreground font-medium">Input Currency</span>
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
                    Spend {tokenConfig.payoutSymbol}
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
                    ? `Amount to Invest (${tokenConfig.payoutSymbol})`
                    : `Shares to Buy (${tokenConfig.symbol})`
                  : `Shares to Sell (${tokenConfig.symbol})`}
              </span>
              <span className="text-xs">
                Available:{" "}
                <span className="font-semibold text-foreground">
                  {isBuy
                    ? `${usdcBalance !== null ? usdcBalance.toFixed(2) : "0.00"} ${tokenConfig.payoutSymbol}`
                    : `${userShares !== null ? userShares.toFixed(4) : "0.00"} ${tokenConfig.symbol}`}
                </span>
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="relative">
                <Input
                  type="number"
                  min="0.001"
                  step={isBuy && buyMode === "usdc" ? "1" : "0.001"}
                  placeholder="0.00"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className="pr-20 text-lg font-medium"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
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
                        ? tokenConfig.payoutSymbol
                        : tokenConfig.symbol
                      : tokenConfig.symbol}
                  </span>
                </div>
              </div>

              {/* Real-time conversion preview */}
              {quote && parsedValue > 0 && (
                <div className="flex items-center justify-between text-xs px-1 text-muted-foreground">
                  <span>
                    {isBuy
                      ? buyMode === "usdc"
                        ? "≈ You will receive:"
                        : "≈ Estimated Total Cost:"
                      : "≈ Estimated Net Proceeds:"}
                  </span>
                  <span className="font-semibold text-foreground">
                    {isBuy
                      ? buyMode === "usdc"
                        ? `${quote.amountDisplay.toFixed(4)} ${tokenConfig.symbol}`
                        : `${currSymbol}${(quote as BuyQuote).totalCostUSD.toFixed(2)} ${tokenConfig.payoutSymbol}`
                      : `${currSymbol}${(quote as SellQuote).netProceedsUSD.toFixed(2)} ${tokenConfig.payoutSymbol}`}
                  </span>
                </div>
              )}
            </div>

            {/* Quote details breakdown */}
            {quote && (
              <div className="rounded-xl bg-secondary/40 border border-border/60 p-3.5 text-xs space-y-2">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>{isBuy ? "Estimated Shares" : "Shares Sold"}</span>
                  <span className="font-semibold text-foreground">
                    {quote.amountDisplay.toFixed(4)} {tokenConfig.symbol}
                  </span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Unit Price</span>
                  <span className="font-medium text-foreground">
                    {currSymbol}{quote.unitPriceUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })} {tokenConfig.payoutSymbol}
                  </span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Protocol Fee ({marketOverview?.asset.feePercent ?? 1.5}%)</span>
                  <span className="font-medium text-foreground">
                    {currSymbol}{quote.feeUSD.toFixed(2)} {tokenConfig.payoutSymbol}
                  </span>
                </div>
                <div className="border-t border-border/50 pt-2 flex items-center justify-between font-semibold text-sm">
                  <span>{isBuy ? "Total Cost" : "Net Proceeds"}</span>
                  <span className={isBuy ? "text-primary" : "text-emerald-500"}>
                    {currSymbol}{(isBuy ? (quote as BuyQuote).totalCostUSD : (quote as SellQuote).netProceedsUSD).toFixed(2)} {tokenConfig.payoutSymbol}
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
                !quote ||
                !!validationError ||
                !marketOverview?.asset.isActive
              }
              onClick={handleExecute}
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting to Solana...</span>
                </span>
              ) : isBuy ? (
                buyMode === "usdc" && quote ? (
                  `Confirm Buy (~${quote.amountDisplay.toFixed(4)} ${tokenConfig.symbol})`
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
