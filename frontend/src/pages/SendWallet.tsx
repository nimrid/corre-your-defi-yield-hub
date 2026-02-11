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

const API_BASE_URL =
  import.meta.env.VITE_BACKEND_URL ||
  "http://localhost:4000";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // Solana USDC

const SendWallet = () => {
  const navigate = useNavigate();
  const { user } = usePrivy();
  const { wallets } = useSolanaWallets();

  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [network, setNetwork] = useState("solana");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

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

      // Check gas sponsorship eligibility first
      try {
        const eligibilityResponse = await fetch(`${API_BASE_URL}/gas-sponsorship/check`, {
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
      } catch (eligibilityError) {
        console.error("Eligibility check error:", eligibilityError);
        // Continue anyway - don't block transaction if eligibility check fails
        console.warn("Proceeding with transaction despite eligibility check failure");
      }

      const {
        Connection,
        PublicKey,
        Transaction,
      } = await import("@solana/web3.js");
      const {
        getAssociatedTokenAddress,
        createTransferInstruction,
        createAssociatedTokenAccountInstruction,
      } = await import("@solana/spl-token");

      const SOLANA_RPC =
        import.meta.env.VITE_SOLANA_RPC ??
        "https://solana-mainnet.g.alchemy.com/v2/C5-LCLXSwlCEtsquSDPIj";

      const connection = new Connection(SOLANA_RPC, "confirmed");

      const fromPubkey = new PublicKey(selectedWallet.address);
      const toPubkey = new PublicKey(address);
      const usdcMint = new PublicKey(USDC_MINT);

      const fromTokenAccount = await getAssociatedTokenAddress(usdcMint, fromPubkey);
      const toTokenAccount = await getAssociatedTokenAddress(usdcMint, toPubkey);

      const amountNumber = Number(amount);
      // USDC has 6 decimals on Solana
      const rawAmount = Math.floor(amountNumber * 1_000_000);

      const { blockhash } = await connection.getLatestBlockhash("finalized");

      const transaction = new Transaction();
      transaction.feePayer = fromPubkey;
      transaction.recentBlockhash = blockhash;

      // Check if recipient's token account exists, create it if not
      const toAccountInfo = await connection.getAccountInfo(toTokenAccount);
      if (!toAccountInfo) {
        const createAccountIx = createAssociatedTokenAccountInstruction(
          fromPubkey, // payer
          toTokenAccount, // associated token account
          toPubkey, // owner
          usdcMint // mint
        );
        transaction.add(createAccountIx);
      }

      // Add the transfer instruction
      const transferIx = createTransferInstruction(
        fromTokenAccount,
        toTokenAccount,
        fromPubkey,
        rawAmount
      );
      transaction.add(transferIx);

      // Security: Strip CloseAccount instructions to prevent rent refund exploitation
      // See: https://docs.privy.io/wallets/gas-and-asset-management/gas/security
      transaction.instructions = transaction.instructions.filter((instruction) => {
        // CloseAccount instruction has discriminator 0x0a (10 in decimal)
        const discriminator = instruction.data[0];
        return discriminator !== 0x0a;
      });

      // Use Privy wallet client to sign and send transaction with gas sponsorship
      // Privy automatically sponsors the transaction for embedded wallets
      const signedTxResponse = await selectedWallet.signTransaction({
        transaction: transaction.serialize({ requireAllSignatures: false }),
      });
      
      const signature = await connection.sendRawTransaction(signedTxResponse.signedTransaction);
      
      // Wait for confirmation
      await connection.confirmTransaction(signature, "confirmed");

      setSuccess(`Transaction submitted: ${signature}`);

      // Fire-and-forget call to backend to record this outgoing USDC transaction
      // If the user is not available, we skip recording rather than blocking the UI.
      const privyUserId = user?.id;
      if (privyUserId) {
        void fetch(`${API_BASE_URL}/transactions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            privyUserId,
            chainType: "solana",
            assetSymbol: "USDC",
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
                <Label htmlFor="amount">Amount (USDC)</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
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
