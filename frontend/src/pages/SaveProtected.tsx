import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePrivy } from "@privy-io/react-auth";
import { useSignAndSendTransaction, useWallets as useSolanaWallets } from "@privy-io/react-auth/solana";

const API_BASE_URL =
  import.meta.env.VITE_BACKEND_URL ||
  "http://localhost:4000";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const LULO_REFERRER = "6pZiqTT81nKLxMvQay7P6TrRx9NdWG5zbakaZdQoWoUb";

const SaveProtected = () => {
  const navigate = useNavigate();
  const { user } = usePrivy();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const { wallets } = useSolanaWallets();

  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [protectedBalance, setProtectedBalance] = useState<number | null>(null);
  const [protectedInterest, setProtectedInterest] = useState<number | null>(null);

  useEffect(() => {
    const fetchAccount = async () => {
      const selectedWallet = wallets[0];
      const owner = selectedWallet?.address;

      if (!owner) return;

      const apiKey = import.meta.env.VITE_LULO_API_KEY;
      if (!apiKey) {
        // Don't block the page if the key is missing; deposit/withdraw will surface this error.
        return;
      }

      try {
        const url = new URL("https://api.lulo.fi/v1/account.getAccount");
        url.searchParams.set("owner", owner);

        const res = await fetch(url.toString(), {
          method: "GET",
          headers: {
            "x-api-key": apiKey,
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) return;

        const data = await res.json();

        const protectedValue: number | undefined = (data as any)?.pusdUsdBalance;
        const protectedInterestEarned: number | undefined = (data as any)?.protectedInterestEarned;

        if (typeof protectedValue === "number") {
          setProtectedBalance(protectedValue);
        }
        if (typeof protectedInterestEarned === "number") {
          setProtectedInterest(protectedInterestEarned);
        }
      } catch {
        // Ignore account fetch errors for now; core deposit/withdraw still work.
      }
    };

    fetchAccount();
  }, [wallets]);

  const handleDeposit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!amount || Number(amount) <= 0) {
      setError("Please enter a valid amount.");
      return;
    }

    const selectedWallet = wallets[0];
    if (!selectedWallet?.address) {
      setError("No Solana wallet found. Please make sure your wallet is connected.");
      return;
    }

    const apiKey = import.meta.env.VITE_LULO_API_KEY;
    if (!apiKey) {
      setError("Lulo API key is not configured (VITE_LULO_API_KEY)");
      return;
    }

    try {
      setLoading(true);

      const owner = selectedWallet.address;
      const feePayer = selectedWallet.address;
      const protectedAmount = Number(amount); // pass raw USDC amount, no 6-decimal conversion

      const res = await fetch("https://api.lulo.fi/v1/generate.transactions.deposit", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          owner,
          feePayer,
          mintAddress: USDC_MINT,
          regularAmount: 0,
          protectedAmount,
          referrer: LULO_REFERRER,
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to generate deposit transaction: ${res.status}`);
      }

      const data = await res.json();

      const encodedTx: string | undefined =
        (data as any)?.transaction ||
        (data as any)?.tx ||
        (data as any)?.transactions?.[0]?.transaction;

      if (!encodedTx || typeof encodedTx !== "string") {
        throw new Error("Deposit transaction not found in Lulo response.");
      }

      const rawTx = Uint8Array.from(atob(encodedTx), (c) => c.charCodeAt(0));

      const result = await signAndSendTransaction({
        transaction: rawTx,
        wallet: selectedWallet,
      });

      const signature = result?.signature?.toString() ?? "";
      setSuccess(signature ? `Deposit transaction submitted: ${signature}` : "Deposit transaction submitted.");

      const privyUserId = user?.id;
      if (privyUserId && signature) {
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
            txSignature: signature,
            fromAddress: owner,
            toAddress: "lulo_vault_protected",
            source: "save_protected_deposit",
          }),
        }).catch(() => {});

        void fetch(`${API_BASE_URL}/savings`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            privyUserId,
            vaultType: "protected",
            direction: "deposit",
            usdcAmount: amount,
            walletAddress: owner,
            txSignature: signature,
            source: "save_protected_deposit",
          }),
        }).catch(() => {});
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to deposit into vault.");
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    setError(null);
    setSuccess(null);

    if (!amount || Number(amount) <= 0) {
      setError("Please enter a valid amount.");
      return;
    }

    const selectedWallet = wallets[0];
    if (!selectedWallet?.address) {
      setError("No Solana wallet found. Please make sure your wallet is connected.");
      return;
    }

    const apiKey = import.meta.env.VITE_LULO_API_KEY;
    if (!apiKey) {
      setError("Lulo API key is not configured (VITE_LULO_API_KEY)");
      return;
    }

    try {
      setLoading(true);

      const owner = selectedWallet.address;
      const feePayer = selectedWallet.address;
      const withdrawAmount = Number(amount); // pass raw USDC amount, no 6-decimal conversion

      const res = await fetch("https://api.lulo.fi/v1/generate.transactions.withdrawProtected", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          owner,
          feePayer,
          mintAddress: USDC_MINT,
          amount: withdrawAmount,
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to generate withdraw transaction: ${res.status}`);
      }

      const data = await res.json();

      const encodedTx: string | undefined = (data as any)?.transaction;

      if (!encodedTx || typeof encodedTx !== "string") {
        throw new Error("Withdraw transaction not found in Lulo response.");
      }

      const rawTx = Uint8Array.from(atob(encodedTx), (c) => c.charCodeAt(0));

      const result = await signAndSendTransaction({
        transaction: rawTx,
        wallet: selectedWallet,
      });

      const signature = result?.signature?.toString() ?? "";
      setSuccess(signature ? `Withdraw transaction submitted: ${signature}` : "Withdraw transaction submitted.");

      const privyUserId = user?.id;
      if (privyUserId && signature) {
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
            direction: "incoming",
            txSignature: signature,
            fromAddress: "lulo_vault_protected",
            toAddress: owner,
            source: "save_protected_withdraw",
          }),
        }).catch(() => {});

        void fetch(`${API_BASE_URL}/savings`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            privyUserId,
            vaultType: "protected",
            direction: "withdrawal",
            usdcAmount: amount,
            walletAddress: owner,
            txSignature: signature,
            source: "save_protected_withdraw",
          }),
        }).catch(() => {});
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to withdraw from vault.");
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
          onClick={() => navigate("/save")}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <div className="glass-card p-6 sm:p-8 rounded-2xl space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Protected save
            </h1>
            <p className="text-sm text-muted-foreground">
              Deposit USDC into the protected DeFi savings vault.
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-secondary/30 px-4 py-3 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div className="min-w-0">
                <p className="text-muted-foreground truncate">Protected balance</p>
                <p
                  className="font-semibold break-all"
                  title={protectedBalance !== null ? `${protectedBalance.toFixed(2)} USDC` : undefined}
                >
                  {protectedBalance !== null ? `${protectedBalance.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} USDC` : "-"}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-muted-foreground truncate">Earnings so far</p>
                <p
                  className="font-semibold break-all"
                  title={protectedInterest !== null ? `${protectedInterest.toFixed(2)} USDC` : undefined}
                >
                  {protectedInterest !== null ? `${protectedInterest.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} USDC` : "-"}
                </p>
              </div>
            </div>
          </div>

          <form className="space-y-6" onSubmit={handleDeposit}>
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

            {error && <p className="text-sm text-red-500">{error}</p>}
            {success && <p className="text-sm text-emerald-500 break-all">{success}</p>}

            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                className="flex-1 bg-gradient-to-r from-primary to-accent hover:opacity-90 disabled:opacity-60"
                disabled={loading}
              >
                {loading ? "Depositing..." : "Deposit"}
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={handleWithdraw}
                disabled={loading}
              >
                {loading ? "Withdrawing..." : "Withdraw"}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default SaveProtected;
