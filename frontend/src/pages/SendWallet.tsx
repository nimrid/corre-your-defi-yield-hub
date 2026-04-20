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
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { FormEvent, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";

import {
  useWallets as useSolanaWallets,
} from "@privy-io/react-auth/solana";
import { apiFetch } from "@/services/apiClient";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // Solana USDC

const SendWallet = () => {
  const navigate = useNavigate();
  const { user } = usePrivy();
  const { wallets } = useSolanaWallets();

  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [network, setNetwork] = useState("solana");
  const [token, setToken] = useState("SOL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sponsorshipMessage, setSponsorshipMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSponsorshipMessage(null);

    if (!amount || Number(amount) <= 0) {
      setError("Please enter a valid amount.");
      return;
    }

    if (!address) {
      setError("Please enter a recipient wallet address.");
      return;
    }

    if (network !== "solana") {
      setError("This flow currently supports only Solana.");
      return;
    }

    // Debug: Log all wallets to see what we have
    console.log("Available wallets:", wallets.map((w: any) => ({
      address: w.address,
      connectorType: w.connectorType,
      walletClientType: w.walletClientType,
      imported: w.imported,
      chainType: w.chainType,
    })));

    // Use the first Solana wallet - if it's embedded, sponsorship will work
    // If it's external, Privy will throw the error
    const selectedWallet = wallets[0];

    if (!selectedWallet?.address) {
      setError("No Solana wallet found. Please make sure your wallet is connected.");
      return;
    }

    console.log("Using wallet:", {
      address: selectedWallet.address,
      connectorType: (selectedWallet as any).connectorType,
      walletClientType: (selectedWallet as any).walletClientType,
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
      const instructions: any[] = [];

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
        const signedTxResponse = await (selectedWallet as any).signTransaction({
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
            const errObj = JSON.parse(errText);
            errText = errObj.error || errText;
          } catch(e) {}
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
      } catch (confirmError: any) {
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

      setSuccess(`Transaction submitted successfully! Hash: ${signature}`);

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
        }).catch(() => {
          // Ignore errors here; you can add logging or toasts if desired
        });
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to send transaction.");
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
              Specify the amount, destination address, and network to send your
              funds.
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>Token</Label>
                <Select
                  value={token}
                  onValueChange={(val) => setToken(val)}
                >
                  <SelectTrigger className="bg-secondary/50 border-border/50">
                    <SelectValue placeholder="Select token" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SOL">SOL (Solana)</SelectItem>
                    <SelectItem value="USDC">USDC (USD Coin)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount ({token})</Label>
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
                <Label htmlFor="address">External wallet address</Label>
                <Input
                  id="address"
                  type="text"
                  placeholder="Paste the recipient's wallet address"
                  className="bg-secondary/50 border-border/50"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Network</Label>
                <Select
                  value={network}
                  onValueChange={(val) => setNetwork(val)}
                >
                  <SelectTrigger className="bg-secondary/50 border-border/50">
                    <SelectValue placeholder="Select network" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solana">Solana</SelectItem>
                    <SelectItem value="base">Base (Ethereum)</SelectItem>
                    <SelectItem value="lisk">Lisk (Ethereum)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {sponsorshipMessage && !error && (
              <p className="text-sm text-amber-500">{sponsorshipMessage}</p>
            )}

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
            {success && (
              <p className="text-sm text-emerald-500 break-all">{success}</p>
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
