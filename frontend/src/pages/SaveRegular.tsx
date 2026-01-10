import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePrivy } from "@privy-io/react-auth";
import { useSignAndSendTransaction, useWallets as useSolanaWallets } from "@privy-io/react-auth/solana";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const LULO_REFERRER = "6pZiqTT81nKLxMvQay7P6TrRx9NdWG5zbakaZdQoWoUb";

interface PendingWithdrawal {
  withdrawalId: number;
  mintAddress: string;
  nativeAmount: string;
  createdTimestamp: number;
  cooldownSeconds: number;
  readyAt: string;
  canComplete: boolean;
}

const SaveRegular = () => {
  const navigate = useNavigate();
  const { user } = usePrivy();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const { wallets } = useSolanaWallets();

  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [positionLoading, setPositionLoading] = useState(false);
  const [positionError, setPositionError] = useState<string | null>(null);
  const [regularDeposited, setRegularDeposited] = useState<number | null>(null);
  const [regularInterestEarned, setRegularInterestEarned] = useState<number | null>(null);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingError, setPendingError] = useState<string | null>(null);
  const [pendingWithdrawal, setPendingWithdrawal] = useState<PendingWithdrawal | null>(null);

  useEffect(() => {
    const fetchPosition = async () => {
      const selectedWallet = wallets[0];
      if (!selectedWallet?.address) return;

      const apiKey = import.meta.env.VITE_LULO_API_KEY;
      if (!apiKey) {
        setPositionError("Lulo API key is not configured (VITE_LULO_API_KEY)");
        return;
      }

      try {
        setPositionLoading(true);
        setPositionError(null);

        const params = new URLSearchParams({ owner: selectedWallet.address });
        const res = await fetch(`https://api.lulo.fi/v1/account.getAccount?${params.toString()}`, {
          method: "GET",
          headers: {
            "x-api-key": apiKey,
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch account: ${res.status}`);
        }

        const data = await res.json();

        const maxWithdrawable = (data as any)?.maxWithdrawable ?? {};
        const regularMap = maxWithdrawable?.regular ?? {};
        const regularForUsdc = typeof regularMap[USDC_MINT] === "number" ? regularMap[USDC_MINT] : 0;

        setRegularDeposited(regularForUsdc);
        setRegularInterestEarned(
          typeof (data as any)?.regularInterestEarned === "number"
            ? (data as any).regularInterestEarned
            : 0,
        );
      } catch (err: any) {
        setPositionError(err?.message ?? "Failed to load position");
      } finally {
        setPositionLoading(false);
      }
    };

    fetchPosition();
  }, [wallets]);

  useEffect(() => {
    const fetchPending = async () => {
      if (!user?.id) return;

      try {
        setPendingLoading(true);
        setPendingError(null);

        const res = await fetch(
          `http://localhost:4000/withdrawals/pending?privyUserId=${encodeURIComponent(
            user.id,
          )}`,
        );

        if (!res.ok) {
          throw new Error(`Failed to fetch pending withdrawals: ${res.status}`);
        }

        const data = await res.json();
        const list: PendingWithdrawal[] = (data?.pendingWithdrawals ?? []) as PendingWithdrawal[];

        const regular = list.find((w) => w.mintAddress === USDC_MINT) ?? null;
        setPendingWithdrawal(regular);
      } catch (err: any) {
        setPendingError(err?.message ?? "Failed to load pending withdrawals");
      } finally {
        setPendingLoading(false);
      }
    };

    fetchPending();
  }, [user?.id]);

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
      const regularAmount = Number(amount); // pass raw USDC amount, no 6-decimal conversion

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
          regularAmount,
          protectedAmount: 0,
          referrer: LULO_REFERRER,
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to generate deposit transaction: ${res.status}`);
      }

      const data = await res.json();

      // Try a couple of reasonable shapes for the returned transaction payload
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
        void fetch("http://localhost:4000/transactions", {
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
            toAddress: "lulo_vault_regular",
            source: "save_regular_deposit",
          }),
        }).catch(() => {});
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to deposit into vault.");
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteWithdraw = async () => {
    if (!pendingWithdrawal) return;

    setError(null);
    setSuccess(null);

    const selectedWallet = wallets[0];
    if (!selectedWallet?.address) {
      setError("No Solana wallet found. Please make sure your wallet is connected.");
      return;
    }

    if (!pendingWithdrawal.canComplete) {
      setError("Withdrawal is still in cooldown. Please try again later.");
      return;
    }

    const apiKey = import.meta.env.VITE_LULO_API_KEY;
    if (!apiKey) {
      setError("Lulo API key is not configured (VITE_LULO_API_KEY)");
      return;
    }

    const privyUserId = user?.id;
    if (!privyUserId) {
      setError("User not found when completing withdrawal.");
      return;
    }

    try {
      setLoading(true);

      const owner = selectedWallet.address;
      const feePayer = selectedWallet.address;

      const completeRes = await fetch(
        "https://api.lulo.fi/v1/generate.transactions.completeRegularWithdrawal",
        {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            owner,
            feePayer,
            pendingWithdrawalId: pendingWithdrawal.withdrawalId,
          }),
        },
      );

      if (!completeRes.ok) {
        throw new Error(`Failed to generate complete withdraw transaction: ${completeRes.status}`);
      }

      const completeData = await completeRes.json();

      const completeEncodedTx: string | undefined =
        (completeData as any)?.transaction ||
        (completeData as any)?.tx ||
        (completeData as any)?.transactions?.[0]?.transaction;

      if (!completeEncodedTx || typeof completeEncodedTx !== "string") {
        throw new Error("Complete withdraw transaction not found in Lulo response.");
      }

      const completeRawTx = Uint8Array.from(atob(completeEncodedTx), (c) => c.charCodeAt(0));

      const result = await signAndSendTransaction({
        transaction: completeRawTx,
        wallet: selectedWallet,
      });

      const signature = result?.signature?.toString() ?? "";
      setSuccess(
        signature
          ? `Withdraw transaction submitted: ${signature}`
          : "Withdraw transaction submitted.",
      );

      await fetch("http://localhost:4000/withdrawals/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ privyUserId, withdrawalId: pendingWithdrawal.withdrawalId }),
      }).catch(() => {});

      await fetch("http://localhost:4000/transactions", {
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
          fromAddress: "lulo_vault_regular",
          toAddress: owner,
          source: "save_regular_withdraw",
        }),
      }).catch(() => {});

      setPendingWithdrawal(null);
    } catch (err: any) {
      setError(err?.message ?? "Failed to complete withdrawal.");
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

    try {
      setLoading(true);

      const owner = selectedWallet.address;
      const feePayer = selectedWallet.address;
      const withdrawAmount = Number(amount); // raw USDC amount, no 6-decimal conversion

      // Phase 1: initiate regular withdraw
      const initRes = await fetch(
        "https://api.lulo.fi/v1/generate.transactions.initiateRegularWithdraw",
        {
          method: "POST",
          headers: {
            "x-api-key": import.meta.env.VITE_LULO_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            owner,
            feePayer,
            mintAddress: USDC_MINT,
            amount: withdrawAmount,
          }),
        },
      );

      if (!initRes.ok) {
        throw new Error(`Failed to generate initiate withdraw transaction: ${initRes.status}`);
      }

      const initData = await initRes.json();

      const initEncodedTx: string | undefined =
        (initData as any)?.transaction ||
        (initData as any)?.tx ||
        (initData as any)?.transactions?.[0]?.transaction;

      if (!initEncodedTx || typeof initEncodedTx !== "string") {
        throw new Error("Initiate withdraw transaction not found in Lulo response.");
      }

      const initRawTx = Uint8Array.from(atob(initEncodedTx), (c) => c.charCodeAt(0));

      await signAndSendTransaction({
        transaction: initRawTx,
        wallet: selectedWallet,
      });

      // Look up the pending withdrawal id via listPendingWithdrawals on Lulo,
      // then persist it in our backend so cooldown state is shared across devices.
      const listParams = new URLSearchParams({ owner });
      const listRes = await fetch(
        `https://api.lulo.fi/v1/account.withdrawals.listPendingWithdrawals?${listParams.toString()}`,
        {
          method: "GET",
          headers: {
            "x-api-key": import.meta.env.VITE_LULO_API_KEY,
            "Content-Type": "application/json",
          },
        },
      );

      if (!listRes.ok) {
        throw new Error(`Failed to list pending withdrawals: ${listRes.status}`);
      }

      const listData = await listRes.json();
      const pendingList: any[] = (listData as any)?.pendingWithdrawals ?? [];

      if (!Array.isArray(pendingList) || pendingList.length === 0) {
        throw new Error("No pending withdrawals found after initiate.");
      }

      const matching = pendingList
        .filter((w) => w && w.owner === owner && w.mintAddress === USDC_MINT)
        .sort((a, b) => (b.createdTimestamp ?? 0) - (a.createdTimestamp ?? 0))[0];

      const privyUserId = user?.id;
      if (!privyUserId) {
        throw new Error("User not found when recording pending withdrawal.");
      }

      await fetch("http://localhost:4000/withdrawals/pending", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          privyUserId,
          owner,
          withdrawalId: matching.withdrawalId,
          mintAddress: matching.mintAddress,
          nativeAmount: matching.nativeAmount,
          createdTimestamp: matching.createdTimestamp,
          cooldownSeconds: Number(matching.cooldownSeconds ?? 0),
          source: "save_regular_withdraw",
        }),
      }).catch(() => {});

      setSuccess(
        "Withdrawal initiated. You will be able to complete it after the cooldown period.",
      );

      // Refresh pending state so the UI shows the scheduled withdrawal.
      setPendingWithdrawal({
        withdrawalId: matching.withdrawalId,
        mintAddress: matching.mintAddress,
        nativeAmount: matching.nativeAmount,
        createdTimestamp: matching.createdTimestamp,
        cooldownSeconds: Number(matching.cooldownSeconds ?? 0),
        readyAt: "", // backend will compute this on next fetch
        canComplete: false,
      });
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
              Regular save
            </h1>
            <p className="text-sm text-muted-foreground">
              Deposit USDC into the regular DeFi savings vault.
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-secondary/30 px-4 py-3 text-sm">
            {positionLoading ? (
              <p className="text-muted-foreground">Loading your position...</p>
            ) : positionError ? (
              <p className="text-red-500">{positionError}</p>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="min-w-0">
                  <p className="text-muted-foreground truncate">Regular balance</p>
                  <p
                    className="font-semibold break-all"
                    title={
                      regularDeposited !== null
                        ? `${regularDeposited.toFixed(2)} USDC`
                        : undefined
                    }
                  >
                    {regularDeposited !== null
                      ? `${regularDeposited.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })} USDC`
                      : "-"}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-muted-foreground truncate">Earnings so far</p>
                  <p
                    className="font-semibold break-all"
                    title={
                      regularInterestEarned !== null
                        ? `${regularInterestEarned.toFixed(2)} USDC`
                        : undefined
                    }
                  >
                    {regularInterestEarned !== null
                      ? `${regularInterestEarned.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })} USDC`
                      : "-"}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border/60 bg-secondary/20 px-4 py-3 text-sm space-y-1">
            {pendingLoading ? (
              <p className="text-muted-foreground">Checking pending withdrawals...</p>
            ) : pendingError ? (
              <p className="text-red-500">{pendingError}</p>
            ) : pendingWithdrawal ? (
              <>
                <p className="text-muted-foreground">
                  Pending regular withdrawal ID {pendingWithdrawal.withdrawalId}
                </p>
                <p className="text-muted-foreground">
                  Amount (native): {pendingWithdrawal.nativeAmount}
                </p>
                {pendingWithdrawal.readyAt && (
                  <p className="text-muted-foreground">
                    Ready at: {new Date(pendingWithdrawal.readyAt).toLocaleString()}
                  </p>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">No pending regular withdrawals.</p>
            )}
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

            {pendingWithdrawal && (
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  className="flex-1"
                  onClick={handleCompleteWithdraw}
                  disabled={loading || !pendingWithdrawal.canComplete}
                >
                  {loading
                    ? "Completing..."
                    : pendingWithdrawal.canComplete
                    ? "Complete withdrawal"
                    : "Complete (cooldown active)"}
                </Button>
            </div>
            )}
          </form>
        </div>
      </main>
    </div>
  );
};

export default SaveRegular;
