import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { FormEvent, useState, useEffect } from "react";
import { usePrivy, useWallets as useEvmWallets, getEmbeddedConnectedWallet } from "@privy-io/react-auth";

import {
  useWallets as useSolanaWallets,
} from "@privy-io/react-auth/solana";
import { useInvalidateTransactionHistory } from "@/hooks/useTransactionHistory";
import { apiFetch } from "@/services/apiClient";
import { arc, getArcPublicClient } from "@/config/arcChain";
import { isAddress, parseEther, formatEther } from "viem";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // Solana USDC

const SendWallet = () => {
  const navigate = useNavigate();
  const { user } = usePrivy();
  const { wallets: solanaWallets } = useSolanaWallets();
  const { wallets: evmWallets } = useEvmWallets();
  const invalidateTxHistory = useInvalidateTransactionHistory();

  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [network, setNetwork] = useState("solana");
  const [token, setToken] = useState("SOL");
  const [arcBalance, setArcBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [txDetails, setTxDetails] = useState<{ hash: string; explorerUrl: string } | null>(null);
  const [sponsorshipMessage, setSponsorshipMessage] = useState<string | null>(null);

  // Fetch live Arc balance using dedicated Arc RPC
  useEffect(() => {
    let isMounted = true;
    if (network !== "arc") {
      setArcBalance(null);
      return;
    }

    const selectedEvmWallet = getEmbeddedConnectedWallet(evmWallets) || evmWallets[0];
    if (!selectedEvmWallet?.address) {
      setArcBalance(null);
      return;
    }

    const fetchBalance = async () => {
      try {
        const client = getArcPublicClient();
        const raw = await client.getBalance({
          address: selectedEvmWallet.address as `0x${string}`,
        });
        if (isMounted) {
          setArcBalance(formatEther(raw));
        }
      } catch (err) {
        console.warn("[SendWallet] Failed to fetch Arc balance:", err);
        if (isMounted) setArcBalance(null);
      }
    };

    void fetchBalance();
    return () => {
      isMounted = false;
    };
  }, [network, evmWallets]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setTxDetails(null);
    setSponsorshipMessage(null);

    if (!amount || Number(amount) <= 0) {
      setError("Please enter a valid amount.");
      return;
    }

    if (!address) {
      setError("Please enter a recipient wallet address.");
      return;
    }

    // ── ARC BLOCKCHAIN FLOW ──────────────────────────────────────────────
    if (network === "arc") {
      const trimmedAddress = address.trim();
      if (!isAddress(trimmedAddress)) {
        setError("Please enter a valid Arc (EVM) wallet address starting with 0x (42 characters).");
        return;
      }

      const selectedEvmWallet = getEmbeddedConnectedWallet(evmWallets) || evmWallets[0];

      if (!selectedEvmWallet?.address) {
        setError("No EVM wallet found. Please make sure you are logged in.");
        return;
      }

      try {
        setLoading(true);

        const publicClient = getArcPublicClient();
        // Arc treats USDC as its native currency with 18 decimals at the EVM execution level
        const rawWei = parseEther(amount.trim());

        // Pre-flight balance check using dedicated Arc RPC
        try {
          const balanceWei = await publicClient.getBalance({
            address: selectedEvmWallet.address as `0x${string}`,
          });
          if (balanceWei < rawWei) {
            setError(
              `Insufficient Arc USDC balance. You have ${Number(formatEther(balanceWei)).toFixed(4)} USDC.`
            );
            setLoading(false);
            return;
          }
        } catch (balErr) {
          console.warn("[SendWallet] Could not pre-verify Arc balance:", balErr);
        }

        // Switch to Arc network if needed
        if (selectedEvmWallet.chainId !== `eip155:${arc.id}`) {
          try {
            await selectedEvmWallet.switchChain(arc.id);
          } catch (switchErr: unknown) {
            console.warn("[SendWallet] Notice switching to Arc:", switchErr);
          }
        }

        const provider = await selectedEvmWallet.getEthereumProvider();

        const txHash = (await provider.request({
          method: "eth_sendTransaction",
          params: [
            {
              from: selectedEvmWallet.address,
              to: trimmedAddress,
              value: `0x${rawWei.toString(16)}`,
            },
          ],
        })) as string;

        const explorerUrl = `https://explorer.arc.io/tx/${txHash}`;
        setSuccess(`Transaction broadcast! Confirming on Arc... Hash: ${txHash}`);
        setTxDetails({ hash: txHash, explorerUrl });

        // Wait for confirmation via dedicated Arc RPC
        try {
          await publicClient.waitForTransactionReceipt({
            hash: txHash as `0x${string}`,
          });
          setSuccess(`Transaction confirmed successfully on Arc! Hash: ${txHash}`);
        } catch (receiptErr) {
          console.warn("[SendWallet] Wait for receipt timed out or failed:", receiptErr);
          setSuccess(`Transaction submitted! Hash: ${txHash}`);
        }

        // Record in backend transaction history
        const privyUserId = user?.id;
        if (privyUserId) {
          void apiFetch("/transactions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              privyUserId,
              chainType: "arc",
              assetSymbol: "USDC",
              amount: amount.trim(),
              direction: "outgoing",
              txSignature: txHash || null,
              fromAddress: selectedEvmWallet.address,
              toAddress: trimmedAddress,
              source: "send_wallet",
            }),
          }).finally(() => {
            void invalidateTxHistory();
          });
        } else {
          void invalidateTxHistory();
        }
      } catch (err: unknown) {
        console.error("[SendWallet] Arc transfer error:", err);
        const errMsg = err instanceof Error ? err.message : String(err);
        setError(errMsg || "Failed to send Arc transaction.");
      } finally {
        setLoading(false);
      }
      return;
    }

    // ── SOLANA BLOCKCHAIN FLOW ───────────────────────────────────────────
    if (network !== "solana") {
      setError("This flow currently supports Solana and Arc.");
      return;
    }

    // Use the first Solana wallet - if it's embedded, sponsorship will work
    // If it's external, Privy will throw the error
    const selectedWallet = solanaWallets[0];

    if (!selectedWallet?.address) {
      setError("No Solana wallet found. Please make sure your wallet is connected.");
      return;
    }

    console.log("Using wallet:", {
      address: selectedWallet.address,
      walletClientType: selectedWallet.walletClientType,
    });

    try {
      setLoading(true);

      let useGasSponsorship = false;
      let feePayerAddress = "";

      // Check gas sponsorship eligibility first
      try {
        const eligibilityResponse = await apiFetch("/gas-sponsorship/check", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            privyUserId: user?.id,
            amountUSD: Number(amount),
          }),
        });

        if (!eligibilityResponse.ok) {
          console.error("Eligibility check failed:", await eligibilityResponse.text());
          setError("Unable to verify transaction eligibility. Please try again.");
          return;
        }

        const eligibility = await eligibilityResponse.json();

        if (!eligibility.allowed) {
          setError(eligibility.reason || "Transaction not allowed at this time.");
          return;
        }

        if (eligibility.sponsorshipAllowed === false) {
          setSponsorshipMessage(
            eligibility.reason ||
            "This amount is above the limit for gas sponsorship. Network fees will be paid from your wallet.",
          );
        } else if (eligibility.feePayerAddress) {
          useGasSponsorship = true;
          feePayerAddress = eligibility.feePayerAddress;
        }
      } catch (eligibilityError) {
        console.error("Eligibility check error:", eligibilityError);
        // Continue anyway - don't block transaction if eligibility check fails
        console.warn("Proceeding with transaction despite eligibility check failure");
      }

      const {
        Connection,
        PublicKey,
        Transaction,
        VersionedTransaction,
        TransactionMessage,
        SystemProgram,
        LAMPORTS_PER_SOL,
      } = await import("@solana/web3.js");
      const {
        getAssociatedTokenAddress,
        createTransferInstruction,
        createAssociatedTokenAccountInstruction,
      } = await import("@solana/spl-token");

      const rawSolanaRpc = import.meta.env.VITE_SOLANA_RPC ?? "https://solana-mainnet.g.alchemy.com/v2/C5-LCLXSwlCEtsquSDPIj";
      const rawWsRpc = import.meta.env.VITE_SOLANA_WS_RPC ?? "wss://mainnet.helius-rpc.com/?api-key=41c75a65-eb0d-4509-9851-7ba59261081a";
      
      const SOLANA_RPC = rawSolanaRpc.replace(/^['"]|['"]$/g, "").trim();
      const SOLANA_WS_RPC = rawWsRpc.replace(/^['"]|['"]$/g, "").trim();

      const connection = new Connection(SOLANA_RPC, {
        commitment: "confirmed",
        wsEndpoint: SOLANA_WS_RPC
      });

      const fromPubkey = new PublicKey(selectedWallet.address);
      const toPubkey = new PublicKey(address);

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

      const amountNumber = Number(amount);
      const instructions: Array<InstanceType<typeof Transaction>["instructions"][number]> = [];

      if (token === "SOL") {
        const rawAmount = Math.floor(amountNumber * LAMPORTS_PER_SOL);
        const transferIx = SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports: rawAmount,
        });
        instructions.push(transferIx);
      } else {
        const usdcMint = new PublicKey(USDC_MINT);
        const fromTokenAccount = await getAssociatedTokenAddress(usdcMint, fromPubkey);
        const toTokenAccount = await getAssociatedTokenAddress(usdcMint, toPubkey);

        // USDC has 6 decimals on Solana
        const rawAmount = Math.floor(amountNumber * 1_000_000);

        // Check if recipient's token account exists, create it if not
        const toAccountInfo = await connection.getAccountInfo(toTokenAccount);
        if (!toAccountInfo) {
          const createAccountIx = createAssociatedTokenAccountInstruction(
            fromPubkey, // payer
            toTokenAccount, // associated token account
            toPubkey, // owner
            usdcMint // mint
          );
          instructions.push(createAccountIx);
        }

        // Add the transfer instruction
        const transferIx = createTransferInstruction(
          fromTokenAccount,
          toTokenAccount,
          fromPubkey,
          rawAmount
        );
        instructions.push(transferIx);
      }

      // Security: Strip CloseAccount instructions to prevent rent refund exploitation
      // See: https://docs.privy.io/wallets/gas-and-asset-management/gas/security
      const filteredInstructions = instructions.filter((instruction) => {
        // CloseAccount instruction has discriminator 0x0a (10 in decimal)
        if (instruction.data && instruction.data.length > 0) {
          const discriminator = instruction.data[0];
          return discriminator !== 0x0a;
        }
        return true;
      });

      let signature = "";

      if (useGasSponsorship) {
        const message = new TransactionMessage({
          payerKey: new PublicKey(feePayerAddress),
          recentBlockhash: blockhash,
          instructions: filteredInstructions
        }).compileToV0Message();

        const versionedTransaction = new VersionedTransaction(message);

        // Use native signTransaction to apply the user's signature. 
        // We do NOT broadcast it here; we just serialize the signed transaction to send to backend.
        const signedTxResponse = await selectedWallet.signTransaction({
           transaction: versionedTransaction.serialize()
        });

        const serializedTransaction = Buffer.from(signedTxResponse.signedTransaction).toString('base64');

        const sponsorRes = await apiFetch('/gas-sponsorship/sponsor-transaction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transaction: serializedTransaction })
        });

        if (!sponsorRes.ok) {
          let errText = await sponsorRes.text();
          try {
            const errObj = JSON.parse(errText) as { error?: string };
            errText = errObj.error || errText;
          } catch {
            // Ignore JSON parse failure, keep raw errText
          }
          throw new Error(`Sponsorship failed: ${errText}`);
        }

        const sponsorData = await sponsorRes.json();
        signature = sponsorData.transactionHash;
      } else {
        const transaction = new Transaction();
        transaction.feePayer = fromPubkey;
        transaction.recentBlockhash = blockhash;
        
        for (const ix of filteredInstructions) {
          transaction.add(ix);
        }

        // Use Privy wallet client to sign and send transaction
        const signedTxResponse = await selectedWallet.signTransaction({
          transaction: transaction.serialize({ requireAllSignatures: false }),
        });

        signature = await connection.sendRawTransaction(signedTxResponse.signedTransaction);
      }

      // Wait for confirmation with a more robust approach
      try {
        await connection.confirmTransaction(
          {
            signature,
            blockhash: blockhash,
            lastValidBlockHeight: lastValidBlockHeight,
          },
          "confirmed"
        );
      } catch (confirmError: unknown) {
        console.warn("Confirmation wait timed out or failed, checking status manually:", confirmError);

        // Manual status check if confirmTransaction fails/times out
        const status = await connection.getSignatureStatus(signature);
        const hasSucceeded = status.value?.confirmationStatus === "confirmed" || status.value?.confirmationStatus === "finalized";

        // If it's not confirmed yet but we don't have an error, it might still be in progress
        // But for the user, if we have a signature and no clear failure, we should be optimistic
        // or at least not show a scary "unknown" error if it's already in the ledger.
        if (!hasSucceeded && status.value?.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
        }

        // If we have a status value at all (even "processed"), it's likely fine
        if (!status.value) {
          console.error("No status found for signature after timeout");
          // If we really can't find it, we might still want to show the success but with a warning
          // or just let it fall through to success if we're feeling optimistic.
        }
      }

      const explorerUrl = `https://solscan.io/tx/${signature}`;
      setSuccess(`Transaction submitted successfully! Hash: ${signature}`);
      setTxDetails({ hash: signature, explorerUrl });

      // Fire-and-forget call to backend to record this outgoing USDC transaction
      // If the user is not available, we skip recording rather than blocking the UI.
      const privyUserId = user?.id;
      if (privyUserId) {
        void apiFetch("/transactions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            privyUserId,
            chainType: "solana",
            assetSymbol: token,
            amount,
            direction: "outgoing",
            txSignature: signature || null,
            fromAddress: selectedWallet.address,
            toAddress: address,
            source: "send_wallet",
          }),
        }).finally(() => {
          void invalidateTxHistory();
        });
      } else {
        void invalidateTxHistory();
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(errMsg || "Failed to send transaction.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-24 space-y-8">
        <button
          type="button"
          onClick={() => navigate("/send")}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <div className="glass-card p-6 sm:p-8 rounded-2xl space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Send to wallet
            </h1>
            <p className="text-sm text-muted-foreground">
              Transfer funds across Solana or Arc network to an external wallet address.
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>Network</Label>
                <Select
                  value={network}
                  onValueChange={(val) => {
                    setNetwork(val);
                    if (val === "arc") {
                      setToken("USDC");
                    } else if (val === "solana" && token !== "SOL" && token !== "USDC") {
                      setToken("SOL");
                    }
                  }}
                >
                  <SelectTrigger className="bg-secondary/50 border-border/50">
                    <SelectValue placeholder="Select network" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solana">Solana</SelectItem>
                    <SelectItem value="arc">Arc (Circle Layer-1)</SelectItem>
                    <SelectItem value="base" disabled>Base (Coming Soon)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Token</Label>
                <Select
                  value={token}
                  onValueChange={(val) => setToken(val)}
                  disabled={network === "arc"}
                >
                  <SelectTrigger className="bg-secondary/50 border-border/50">
                    <SelectValue placeholder="Select token" />
                  </SelectTrigger>
                  <SelectContent>
                    {network === "arc" ? (
                      <SelectItem value="USDC">USDC (Native Gas & Asset)</SelectItem>
                    ) : (
                      <>
                        <SelectItem value="SOL">SOL (Solana)</SelectItem>
                        <SelectItem value="USDC">USDC (USD Coin)</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="amount">Amount ({token})</Label>
                  {network === "arc" && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>
                        Available:{" "}
                        <strong className="text-foreground">
                          {arcBalance !== null
                            ? `${Number(arcBalance).toLocaleString(undefined, { maximumFractionDigits: 4 })} USDC`
                            : "Loading..."}
                        </strong>
                      </span>
                      {arcBalance !== null && Number(arcBalance) > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const num = Number(arcBalance);
                            // Leave 0.001 USDC for gas fees on Arc
                            const maxUsable = Math.max(0, num - 0.001);
                            setAmount(maxUsable > 0 ? maxUsable.toFixed(4) : num.toString());
                          }}
                          className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors uppercase tracking-wider"
                        >
                          Max
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.000000001"
                  placeholder="0.00"
                  className="bg-secondary/50 border-border/50"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">
                  {network === "arc" ? "Recipient Arc (EVM) wallet address" : "Recipient Solana wallet address"}
                </Label>
                <Input
                  id="address"
                  type="text"
                  placeholder={
                    network === "arc"
                      ? "0x... (42-character EVM address)"
                      : "Paste the recipient's Solana wallet address"
                  }
                  className="bg-secondary/50 border-border/50 font-mono text-sm"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
            </div>

            {sponsorshipMessage && !error && (
              <p className="text-sm text-amber-500">{sponsorshipMessage}</p>
            )}

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            {success && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 space-y-2">
                <p className="text-sm font-medium break-all">{success}</p>
                {txDetails?.explorerUrl && (
                  <a
                    href={txDetails.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-primary underline hover:text-primary/80 transition-colors"
                  >
                    <span>View on block explorer</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            )}

            <div className="pt-2">
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 disabled:opacity-60"
                disabled={loading}
              >
                {loading ? "Sending..." : "Send"}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default SendWallet;
