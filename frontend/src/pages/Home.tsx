import Navigation from "@/components/Navigation";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Copy, ChevronDown, QrCode, Plus, Wallet, ExternalLink, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { US_STOCK_TOKENS } from "@/config/usStockTokens";
import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { apiFetch } from "@/services/apiClient";
import { getAllTransactions } from "paj_ramp";
import type { PajTransaction } from "paj_ramp";
import { usePajSession } from "@/hooks/usePajSession";

interface TransactionRow {
  id: number;
  chainType: string;
  assetSymbol: string;
  amount: string;
  direction: "incoming" | "outgoing";
  txSignature?: string | null;
  fromAddress: string;
  toAddress: string;
  source?: string | null;
  createdAt: string;
}

interface StockHistoryRow {
  id: number;
  stockMint: string;
  stockSymbol: string | null;
  stockName: string | null;
  usdcAmount: string;
  sharesAmount: string | null;
  walletAddress: string | null;
  txSignature: string | null;
  jupiterRequestId: string | null;
  source: string | null;
  createdAt: string;
  side: "buy" | "sell";
}

interface StockHolding {
  mint: string;
  name: string;
  symbol: string;
  amount: number;
}

interface SavingsActivityRow {
  id: number;
  vaultType: "regular" | "protected";
  direction: "deposit" | "withdrawal";
  amount: string;
  walletAddress: string | null;
  txSignature: string | null;
  source: string | null;
  createdAt: string;
}

const formatVaultLabel = (value: string): string => {
  if (value === "lulo_vault_regular") {
    return "Standard savings vault";
  }
  if (value === "lulo_vault_protected") {
    return "Shielded savings vault";
  }
  return value;
};

const Home = () => {
  const { ready, authenticated, user } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const navigate = useNavigate();
  const hasSyncedRef = useRef(false);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [savingsActivity, setSavingsActivity] = useState<SavingsActivityRow[]>([]);
  const [savingsLoading, setSavingsLoading] = useState(false);
  const [savingsError, setSavingsError] = useState<string | null>(null);
  const [stockHistory, setStockHistory] = useState<StockHistoryRow[]>([]);
  const [stockHistoryLoading, setStockHistoryLoading] = useState(false);
  const [stockHistoryError, setStockHistoryError] = useState<string | null>(null);
  const [stocksOpen, setStocksOpen] = useState(false);
  const [stockBalances, setStockBalances] = useState<StockHolding[] | null>(null);
  const [stocksLoading, setStocksLoading] = useState(false);
  const [stocksError, setStocksError] = useState<string | null>(null);

  const { sessionToken } = usePajSession();
  const [fiatTransactions, setFiatTransactions] = useState<PajTransaction[]>([]);
  const [fiatLoading, setFiatLoading] = useState(false);
  const [fiatError, setFiatError] = useState<string | null>(null);

  const solanaWallets = wallets.filter((w) => w.walletClientType === "solana");
  const ethereumWallets = wallets.filter((w) => w.walletClientType === "ethereum");

  const linkedWallets = (user?.linkedAccounts ?? []).filter(
    (a: any) => a.type === "wallet" || a.type === "smart_wallet"
  );

  const linkedSolana = linkedWallets.filter(
    (a: any) => a.chainType === "solana" || a.chain === "solana"
  );
  const linkedEthereum = linkedWallets.filter(
    (a: any) => a.chainType === "ethereum" || a.chain === "ethereum"
  );

  const primarySolanaAddress: string | undefined =
    (solanaWallets[0] as any)?.address ??
    (linkedSolana[0] as any)?.address;

  useEffect(() => {
    if (ready && !authenticated) {
      navigate("/");
    }
  }, [ready, authenticated, navigate]);

  useEffect(() => {
    if (!ready || !authenticated || !user) return;
    if (hasSyncedRef.current) return;

    const syncUser = async () => {
      try {
        const linkedWallets = (user.linkedAccounts ?? []).filter(
          (a: any) => a.type === "wallet" || a.type === "smart_wallet",
        );

        const linkedSolana = linkedWallets
          .filter((a: any) => a.chainType === "solana" || a.chain === "solana")
          .map((a: any) => ({
            address: a.address,
            chainType: "solana" as const,
            isLinked: true,
          }));

        const linkedEthereum = linkedWallets
          .filter((a: any) => a.chainType === "ethereum" || a.chain === "ethereum")
          .map((a: any) => ({
            address: a.address,
            chainType: "ethereum" as const,
            isLinked: true,
          }));

        const payload = {
          privyUserId: user.id,
          email: user.email?.address ?? null,
          name: user.google?.name ?? null,
          wallets: [...linkedSolana, ...linkedEthereum],
          referredByCode: localStorage.getItem("referredByCode"),
        };

        await apiFetch("/users/upsert", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        hasSyncedRef.current = true;
      } catch {
        // Swallow errors for now; you can add toasts/logging if desired
      }
    };

    void syncUser();
  }, [ready, authenticated, user]);

  useEffect(() => {
    const fetchStocks = async () => {
      if (!stocksOpen) return;
      if (!primarySolanaAddress) return;
      if (stockBalances !== null || stocksLoading) return;

      try {
        setStocksLoading(true);
        setStocksError(null);
        const HELIUS_DAS_URL =
          import.meta.env.VITE_HELIUS_DAS_URL ||
          import.meta.env.VITE_SOLANA_DAS_URL ||
          "";

        if (!HELIUS_DAS_URL) {
          setStocksError("Helius DAS URL is not configured");
          return;
        }

        const response = await fetch(HELIUS_DAS_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: "stocks-portfolio",
            method: "getAssetsByOwner",
            params: {
              ownerAddress: primarySolanaAddress,
              page: 1,
              limit: 1000,
              displayOptions: {
                showFungible: true,
                showNativeBalance: false,
              },
            },
          }),
        });

        if (!response.ok) {
          throw new Error(`Helius DAS request failed with ${response.status}`);
        }

        const data: any = await response.json();
        const items: any[] = data?.result?.items ?? [];

        const amountsByMint: Record<string, number> = {};

        for (const asset of items) {
          const mint: string | undefined = asset?.id;
          if (!mint) continue;

          const tokenInfo: any = asset.token_info ?? asset?.tokenInfo ?? {};
          const rawBalance = tokenInfo.balance;
          const decimals =
            typeof tokenInfo.decimals === "number" ? tokenInfo.decimals : 0;

          if (rawBalance == null) continue;

          const asNumber =
            typeof rawBalance === "number"
              ? rawBalance
              : Number(rawBalance);
          if (Number.isNaN(asNumber)) continue;

          const uiAmount = decimals ? asNumber / 10 ** decimals : asNumber;
          amountsByMint[mint] = (amountsByMint[mint] ?? 0) + uiAmount;
        }

        const holdings: StockHolding[] = US_STOCK_TOKENS.map((token) => ({
          mint: token.mint,
          name: token.name,
          symbol: token.symbol,
          amount: amountsByMint[token.mint] ?? 0,
        }))
          .filter((h) => h.amount > 0)
          .sort((a, b) => b.amount - a.amount);

        setStockBalances(holdings);
      } catch (err: any) {
        setStocksError(err?.message ?? "Failed to load stocks portfolio");
      } finally {
        setStocksLoading(false);
      }
    };

    void fetchStocks();
  }, [stocksOpen, primarySolanaAddress, stockBalances, stocksLoading]);

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!user?.id) return;

      try {
        setTxLoading(true);
        setTxError(null);

        // Fetch app-recorded transactions from our DB
        const res = await apiFetch(`/transactions/${user.id}`);
        if (!res.ok) {
          throw new Error("Failed to fetch transactions");
        }
        const data = await res.json();
        const dbTransactions: TransactionRow[] = Array.isArray(data) ? data : [];

        // Fetch on-chain USDC transfer history via Helius
        let onchainTransactions: TransactionRow[] = [];
        if (primarySolanaAddress) {
          try {
            const onchainRes = await apiFetch(`/transactions/onchain/${primarySolanaAddress}`);
            if (onchainRes.ok) {
              const onchainData = await onchainRes.json();
              onchainTransactions = Array.isArray(onchainData) ? onchainData : [];
            }
          } catch (err) {
            console.warn("Failed to fetch on-chain transactions:", err);
          }
        }

        // De-duplicate: if a tx signature exists in DB records, skip the on-chain duplicate
        const dbSignatures = new Set(
          dbTransactions
            .map((tx) => tx.txSignature)
            .filter(Boolean)
        );
        const uniqueOnchain = onchainTransactions.filter(
          (tx) => !tx.txSignature || !dbSignatures.has(tx.txSignature)
        );

        setTransactions([...dbTransactions, ...uniqueOnchain]);
      } catch (err: any) {
        setTxError(err?.message ?? "Failed to load transactions");
      } finally {
        setTxLoading(false);
      }
    };

    const fetchSavingsActivity = async () => {
      if (!user?.id) return;

      try {
        setSavingsLoading(true);
        setSavingsError(null);

        const res = await apiFetch(`/savings-activity/${user.id}`);
        if (!res.ok) {
          throw new Error("Failed to fetch savings activity");
        }

        const data = await res.json();
        setSavingsActivity(Array.isArray(data) ? data : []);
      } catch (err: any) {
        setSavingsError(err?.message ?? "Failed to load savings activity");
      } finally {
        setSavingsLoading(false);
      }
    };

    const fetchStockHistory = async () => {
      if (!user?.id) return;

      try {
        setStockHistoryLoading(true);
        setStockHistoryError(null);

        const res = await apiFetch(`/stock-history/${user.id}`);
        if (!res.ok) {
          throw new Error("Failed to fetch stock history");
        }

        const data = await res.json();
        setStockHistory(Array.isArray(data) ? data : []);
      } catch (err: any) {
        setStockHistoryError(err?.message ?? "Failed to load stock history");
      } finally {
        setStockHistoryLoading(false);
      }
    };

    if (ready && authenticated && user) {
      void fetchTransactions();
      void fetchSavingsActivity();
      void fetchStockHistory();
    }
  }, [ready, authenticated, user, primarySolanaAddress]);

  useEffect(() => {
    const fetchFiatTransactions = async () => {
      if (!sessionToken) return;
      try {
        setFiatLoading(true);
        setFiatError(null);
        const data = await getAllTransactions(sessionToken);
        setFiatTransactions(Array.isArray(data) ? data : []);
      } catch (err: any) {
        console.error("Failed to load fiat transactions", err);
        setFiatError(err?.message ?? "Failed to load fiat transactions");
      } finally {
        setFiatLoading(false);
      }
    };
    fetchFiatTransactions();
  }, [sessionToken]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <h1 className="text-4xl font-bold tracking-tight mb-8">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-8">
            {/* Account Card (Combined Balance & Wallets) */}
            <div className="glass-card p-0 overflow-hidden border-primary/20 shadow-xl transition-all duration-300 hover:border-primary/30">
              <div className="p-8 bg-gradient-to-br from-primary/10 via-transparent to-accent/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 -mr-8 -mt-8 w-48 h-48 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-primary group">
                      <ShieldCheck className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      <p className="text-xs font-bold uppercase tracking-[0.2em]">Verified Assets</p>
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-muted-foreground text-sm font-medium">Total Balance</h2>
                      <TotalBalance wallets={[...wallets, ...linkedSolana, ...linkedEthereum]} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => navigate('/buy-usdc')}
                      className="rounded-full px-8 py-6 bg-primary text-primary-foreground hover:opacity-90 shadow-lg shadow-primary/20 text-base font-bold"
                    >
                      <Plus className="w-5 h-5 mr-2" />
                      Buy USDC
                    </Button>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-secondary/10 border-t border-border/40">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-semibold">Your Solana Wallets</h3>
                  </div>
                  {!walletsReady && (
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      Syncing...
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  {!walletsReady ? (
                    <div className="space-y-3">
                      {[1, 2].map((i) => (
                        <div key={i} className="h-16 rounded-2xl bg-secondary/30 animate-pulse" />
                      ))}
                    </div>
                  ) : (
                    <>
                      {solanaWallets.length || linkedSolana.length ? (
                        <div className="grid grid-cols-1 gap-3">
                          {solanaWallets.map((wallet) => (
                            <WalletRow
                              key={(wallet as any).id ?? wallet.address ?? Math.random()}
                              wallet={wallet}
                            />
                          ))}
                          {linkedSolana
                            .filter(
                              (a: any) =>
                                !solanaWallets.some(
                                  (w) => w.address && w.address === a.address
                                )
                            )
                            .map((a: any, idx: number) => (
                              <LinkedWalletRow
                                key={`linked-sol-${idx}-${a.address}`}
                                account={a}
                              />
                            ))}
                        </div>
                      ) : (
                        <div className="text-center py-6 rounded-2xl bg-secondary/20 border border-dashed border-border/60">
                          <p className="text-sm text-muted-foreground">No Solana wallets connected</p>
                          <Button 
                            variant="link" 
                            size="sm" 
                            className="mt-2 text-primary"
                            onClick={() => navigate('/settings')}
                          >
                            Add a wallet
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="glass-card p-6 order-3 md:order-3">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-semibold">Stocks portfolio</h2>
                <button
                  type="button"
                  onClick={() => setStocksOpen((prev) => !prev)}
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span>{stocksOpen ? "Hide" : "View"}</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${stocksOpen ? "rotate-180" : "rotate-0"}`}
                  />
                </button>
              </div>

              {!primarySolanaAddress && (
                <p className="text-sm text-muted-foreground">
                  Connect a Solana wallet to see your stock tokens.
                </p>
              )}

              {primarySolanaAddress && !stocksOpen && (
                <p className="text-sm text-muted-foreground">
                  View balances for your tokenized US stock positions held in your
                  Solana wallet.
                </p>
              )}

              {primarySolanaAddress && stocksOpen && (
                <div className="space-y-4">
                  {stocksLoading && (
                    <p className="text-sm text-muted-foreground">
                      Loading stock balances...
                    </p>
                  )}

                  {stocksError && !stocksLoading && (
                    <p className="text-sm text-red-500 break-words">{stocksError}</p>
                  )}

                  {!stocksLoading && !stocksError && (
                    <>
                      {!stockBalances?.length ? (
                        <p className="text-sm text-muted-foreground">
                          No supported stock tokens found in your Solana wallet.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">
                            Top holdings in your Solana wallet:
                          </p>
                          <ul className="space-y-2">
                            {stockBalances.slice(0, 5).map((holding) => (
                              <li
                                key={holding.mint}
                                className="flex items-center justify-between rounded-lg bg-secondary/30 px-3 py-2 text-sm"
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium">{holding.name}</span>
                                  <span className="text-xs text-muted-foreground uppercase tracking-wide">
                                    {holding.symbol}
                                  </span>
                                </div>
                                <span className="font-mono">
                                  {holding.amount.toLocaleString(undefined, {
                                    maximumFractionDigits: 4,
                                  })}
                                </span>
                              </li>
                            ))}
                            {stockBalances.length > 5 && (
                              <li className="text-xs text-muted-foreground">
                                + {stockBalances.length - 5} more holdings
                              </li>
                            )}
                          </ul>
                        </div>
                      )}

                      <div className="pt-2">
                        <Button
                          type="button"
                          size="sm"
                          className="rounded-full text-xs font-semibold"
                          onClick={() => navigate("/invest/us-stocks")}
                        >
                          Browse US stocks
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Transaction History */}
            <div className="glass-card p-6 order-4">
              <h2 className="text-2xl font-semibold mb-4">Transaction History</h2>
              {txLoading || savingsLoading || fiatLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Loading transactions...</p>
                </div>
              ) : txError || savingsError || fiatError ? (
                <div className="text-center py-8 text-red-500 text-sm">
                  <p>{txError || savingsError || fiatError}</p>
                </div>
              ) : !transactions.length && !savingsActivity.length && !stockHistory.length && !fiatTransactions.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No transactions yet.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {/* Combine and sort transactions and savings activity by date */}
                  {[
                    ...transactions.map((tx) => ({
                      ...tx,
                      type: "transfer" as const,
                      sortDate: new Date(tx.createdAt).getTime(),
                    })),
                    ...savingsActivity.map((sa) => ({
                      ...sa,
                      type: "savings" as const,
                      sortDate: new Date(sa.createdAt).getTime(),
                    })),
                    ...stockHistory.map((sh) => ({
                      ...sh,
                      type: "stock" as const,
                      sortDate: new Date(sh.createdAt).getTime(),
                    })),
                    ...fiatTransactions.map((ft) => ({
                      ...ft,
                      type: "fiat" as const,
                      sortDate: new Date(ft.createdAt || Date.now()).getTime(),
                    })),
                  ]
                    .sort((a, b) => b.sortDate - a.sortDate)
                    .map((item, idx) => {
                      const itemDate = new Date((item as any).createdAt || Date.now()).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      });

                      if (item.type === "transfer") {
                        const tx = item as TransactionRow;
                        return (
                          <div key={`tx-${tx.id}-${idx}`} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl bg-secondary/30 text-sm border border-border/40 hover:border-primary/30 transition-all duration-200">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className={tx.direction === "incoming" ? "text-emerald-500 font-bold" : "text-red-500 font-bold"}>
                                  {tx.direction === "incoming" ? "Received" : "Sent"}
                                </span>
                                <span className="font-mono text-base font-medium">{tx.amount} {tx.assetSymbol}</span>
                              </div>
                              <div className="text-xs text-muted-foreground opacity-80">
                                <div><span className="font-medium text-foreground/70">From:</span> {formatVaultLabel(tx.fromAddress)}</div>
                                <div><span className="font-medium text-foreground/70">To:</span> {formatVaultLabel(tx.toAddress)}</div>
                              </div>
                            </div>
                            <div className="mt-2 sm:mt-0 sm:text-right text-xs text-muted-foreground space-y-1">
                              <div className="font-semibold text-foreground/90">{itemDate}</div>
                              <div className="uppercase tracking-widest text-[10px] font-bold opacity-60">{tx.source === "offramp" ? "Bank Transfer" : tx.source === "onchain" ? "On-chain Transfer" : `${tx.chainType} Transfer`}</div>
                            </div>
                          </div>
                        );
                      } else if (item.type === "savings") {
                        const sa = item as SavingsActivityRow;
                        return (
                          <div key={`sa-${sa.id}-${idx}`} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl bg-blue-500/5 text-sm border border-blue-500/20 hover:border-blue-500/40 transition-all duration-200">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className={sa.direction === "deposit" ? "text-blue-500 font-bold" : "text-orange-500 font-bold"}>
                                  {sa.direction === "deposit" ? "Savings Deposit" : "Savings Withdrawal"}
                                </span>
                                <span className="font-mono text-base font-medium">{sa.amount} USDC</span>
                              </div>
                              <div className="text-xs text-muted-foreground opacity-80">
                                <span className="font-medium text-foreground/70">Vault:</span> {sa.vaultType === "regular" ? "Standard Yield" : "Shielded Yield"}
                              </div>
                            </div>
                            <div className="mt-2 sm:mt-0 sm:text-right text-xs text-muted-foreground space-y-1">
                              <div className="font-semibold text-foreground/90">{itemDate}</div>
                            </div>
                          </div>
                        );
                      } else if (item.type === "fiat") {
                        const ft = item as PajTransaction;
                        const isBuy = ft.transactionType === "ON_RAMP";
                        return (
                          <div key={`ft-${ft.id}-${idx}`} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl bg-orange-500/5 text-sm border border-orange-500/20 hover:border-orange-500/40 transition-all duration-200">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className={isBuy ? "text-emerald-500 font-bold" : "text-orange-500 font-bold"}>
                                  {isBuy ? "Bought USDC (Fiat)" : "Sold USDC (Fiat)"}
                                </span>
                                <span className="font-mono text-base font-medium">{ft.usdcAmount ?? ft.amount} USDC</span>
                              </div>
                              <div className="text-xs text-muted-foreground opacity-80">
                                <div><span className="font-medium text-foreground/70">Fiat Amount:</span> ₦{(ft.fiatAmount ?? ft.amount)?.toLocaleString()}</div>
                                <div><span className="font-medium text-foreground/70">Status:</span> {ft.status}</div>
                              </div>
                            </div>
                            <div className="mt-2 sm:mt-0 sm:text-right text-xs text-muted-foreground space-y-1">
                              <div className="font-semibold text-foreground/90">{itemDate}</div>
                              <div className="uppercase tracking-widest text-[10px] font-bold opacity-60">Fiat {isBuy ? "Deposit" : "Withdrawal"}</div>
                            </div>
                          </div>
                        );
                      } else {
                        const sh = item as StockHistoryRow;
                        return (
                          <div key={`sh-${sh.id}-${idx}`} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl bg-purple-500/5 text-sm border border-purple-500/20 hover:border-purple-500/40 transition-all duration-200">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className={sh.side === "buy" ? "text-purple-500 font-bold" : "text-rose-500 font-bold"}>
                                  {sh.side === "buy" ? "Bought" : "Sold"} {sh.stockSymbol}
                                </span>
                                <span className="font-mono text-base font-medium">{sh.usdcAmount} USDC</span>
                              </div>
                              <div className="text-xs text-muted-foreground opacity-80">
                                <div><span className="font-medium text-foreground/70">Asset:</span> {sh.stockName}</div>
                                {sh.sharesAmount && <div><span className="font-medium text-foreground/70">Shares:</span> {sh.sharesAmount}</div>}
                              </div>
                            </div>
                            <div className="mt-2 sm:mt-0 sm:text-right text-xs text-muted-foreground space-y-1">
                              <div className="font-semibold text-foreground/90">{itemDate}</div>
                            </div>
                          </div>
                        );
                      }
                    })}
                </div>
              )}


            </div>
          </div>
        </div>
      </main>
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-full px-4 sm:px-0">
        <div className="max-w-md mx-auto flex gap-3 rounded-full bg-background/95 border border-border/80 shadow-xl px-4 sm:px-8 py-3 sm:py-4">
          <button
            className="flex-1 text-sm sm:text-base font-semibold px-3 py-2 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition"
            type="button"
            onClick={() => navigate("/send")}
          >
            Send
          </button>
          <button
            className="flex-1 text-sm sm:text-base font-medium px-3 py-2 rounded-full hover:bg-secondary transition-colors"
            type="button"
            onClick={() => navigate("/save")}
          >
            Save
          </button>
          <button
            className="flex-1 text-sm sm:text-base font-medium px-3 py-2 rounded-full hover:bg-secondary transition-colors"
            type="button"
            onClick={() => navigate("/invest")}
          >
            Invest
          </button>
        </div>
      </div>
    </div>
  );
};

const Balance = ({ wallet, address }: { wallet: any, address?: string }) => {
  const { user } = usePrivy();
  const [balance, setBalance] = useState<string>("-");

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        // For Solana wallets, fetch USDC SPL token balance directly via RPC.
        if (
          wallet.chainType === "solana" ||
          (wallet as any).walletClientType === "solana" ||
          (wallet as any).chain === "solana"
        ) {
          if (!address) {
            setBalance("-");
            return;
          }

          const { Connection, PublicKey } = await import("@solana/web3.js");
          const connection = new Connection("https://solana-mainnet.g.alchemy.com/v2/C5-LCLXSwlCEtsquSDPIj", "confirmed");
          const owner = new PublicKey(address);
          const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"); // Solana USDC
          const resp = await connection.getParsedTokenAccountsByOwner(owner, { mint: USDC_MINT });
          console.log("[DEBUG] Solana USDC RPC response for", address.toString(), ":", resp);
          const ui = resp.value.reduce((sum, acc: any) => {
            const amt =
              acc?.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
            return sum + Number(amt || 0);
          }, 0);
          setBalance(
            `${Number(ui).toLocaleString(undefined, {
              maximumFractionDigits: 4,
            })} USDC`,
          );
          return;
        }

        // For non-Solana wallets, use Privy's wallet balance API via wallet_id.
        if (!user) {
          setBalance("-");
          return;
        }

        const linkedWallets = (user.linkedAccounts ?? []).filter(
          (a: any) => a.type === "wallet" || a.type === "smart_wallet",
        );

        const matching = linkedWallets.find((a: any) => {
          const accountAddress = (a.address ?? a.walletAddress) as string | undefined;
          return (
            accountAddress &&
            accountAddress.toLowerCase() === (address ?? "").toLowerCase()
          );
        });

        const walletId = (matching as any)?.walletId ?? (matching as any)?.wallet_id;

        if (!walletId) {
          setBalance("-");
          return;
        }

        const res = await fetch(
          `https://api.privy.io/v1/wallets/${walletId}/balance`,
          {
            method: "GET",
            headers: {
              // NOTE: For production, you should proxy this through your backend instead of calling Privy directly from the client.
              "Content-Type": "application/json",
            },
          },
        );

        if (!res.ok) {
          setBalance("-");
          return;
        }

        const data: any = await res.json();

        if (!Array.isArray(data.balances) || !data.balances.length) {
          setBalance("0");
          return;
        }

        const primary = data.balances[0];
        const symbol = primary.asset?.toUpperCase?.() ?? primary.asset ?? "";
        const raw = primary.raw_value ?? "0";
        const decimals =
          typeof primary.decimals === "number" ? primary.decimals : 18;

        const asNumber = Number(raw) / 10 ** decimals;
        setBalance(
          `${asNumber.toLocaleString(undefined, {
            maximumFractionDigits: 4,
          })} ${symbol}`,
        );
      } catch {
        setBalance("-");
      }
    };

    fetchBalance();
  }, [user, wallet, address]);

  return <p className="text-lg font-bold">{balance}</p>;
};

const TotalBalance = ({ wallets }: { wallets: any[] }) => {
  const [total, setTotal] = useState<string>("-");

  useEffect(() => {
    const fetchTotal = async () => {
      try {
        if (!wallets.length) {
          setTotal("-");
          return;
        }

        let sum = 0;

        for (const wallet of wallets) {
          const address = (wallet as any).address as string | undefined;
          if (!address) continue;

          if (
            wallet.chainType === 'solana' ||
            (wallet as any).walletClientType === 'solana' ||
            (wallet as any).chain === 'solana'
          ) {
            const { Connection, PublicKey } = await import('@solana/web3.js');
            const connection = new Connection("https://solana-mainnet.g.alchemy.com/v2/C5-LCLXSwlCEtsquSDPIj", 'confirmed');
            const owner = new PublicKey(address);
            const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
            const resp = await connection.getParsedTokenAccountsByOwner(owner, { mint: USDC_MINT });
            const ui = resp.value.reduce((innerSum, acc: any) => {
              const amt = acc?.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
              return innerSum + Number(amt || 0);
            }, 0);
            sum += ui || 0;
          } else if (wallet.chainType === 'ethereum') {
            const { ethers } = await import('ethers');
            const provider = new ethers.JsonRpcProvider((wallet as any).rpcUrl ?? undefined);
            const chainId: number | undefined = wallet.chainId;
            const USDC_BY_CHAIN: Record<number, string> = {
              8453: '0x833589fCD6edb6E08f4c7C32D4f71b54bDA02913',
            };
            const usdcAddress = chainId ? USDC_BY_CHAIN[chainId] : undefined;
            if (!usdcAddress) continue;
            const abi = [
              'function balanceOf(address) view returns (uint256)',
              'function decimals() view returns (uint8)'
            ];
            const usdc = new ethers.Contract(usdcAddress, abi, provider);
            const [raw, decimals] = await Promise.all([
              usdc.balanceOf(address),
              usdc.decimals(),
            ]);
            const formatted = ethers.formatUnits(raw, decimals);
            sum += Number(formatted) || 0;
          }
        }

        setTotal(`${sum.toLocaleString(undefined, { maximumFractionDigits: 4 })} USDC`);
      } catch {
        setTotal("-");
      }
    };

    fetchTotal();
  }, [wallets]);

  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-3">
      <p className="text-5xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground via-foreground to-foreground/50">{total}</p>
    </div>
  );
};

export default Home;

const WalletQRDialog = ({ address, label }: { address: string; label: string }) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="p-1 rounded hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-primary"
          title="Show QR Code"
        >
          <QrCode className="w-4 h-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md flex flex-col items-center">
        <DialogHeader className="w-full">
          <DialogTitle className="text-center">{label} QR Code</DialogTitle>
        </DialogHeader>
        <div className="bg-white p-4 rounded-xl mt-4">
          <QRCodeSVG value={address} size={256} level="H" />
        </div>
        <p className="mt-4 font-mono text-xs text-center break-all text-muted-foreground max-w-xs">
          {address}
        </p>
        <Button
          className="mt-4 w-full"
          onClick={() => navigator.clipboard.writeText(address)}
        >
          Copy Address
        </Button>
      </DialogContent>
    </Dialog>
  );
};

const WalletRow = ({ wallet }: { wallet: any }) => {
  const { toast } = useToast();
  const [resolvedAddress, setResolvedAddress] = useState<string | undefined>(wallet.address);

  useEffect(() => {
    let mounted = true;
    const resolve = async () => {
      try {
        if (typeof wallet.getAddress === 'function') {
          const addr = await wallet.getAddress();
          if (mounted && addr) {
            setResolvedAddress(addr);
            return;
          }
        }
      } catch { }
      try {
        if (mounted && wallet.address) setResolvedAddress(wallet.address);
      } catch { }
    };
    resolve();
    return () => { mounted = false; };
  }, [wallet]);

  const truncateAddress = (addr: string) => {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const handleCopy = (addr: string) => {
    navigator.clipboard.writeText(addr).then(() => {
      toast({
        title: "Copied!",
        description: "Address copied to clipboard",
        duration: 2000,
      });
    }).catch(() => { });
  };

  return (
    <div className="flex justify-between items-center p-5 rounded-2xl bg-background/40 hover:bg-background/60 border border-primary/5 hover:border-primary/20 transition-all duration-200 group shadow-sm">
      <div className="flex-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1 opacity-70 group-hover:opacity-100 transition-opacity">
          {wallet.walletClientType} · Solana
        </p>
        <div className="flex items-center gap-2">
          <p className="font-mono text-sm font-medium truncate max-w-[200px]">
            {resolvedAddress ? truncateAddress(resolvedAddress) : 'Resolving...'}
          </p>
          {resolvedAddress && (
            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => handleCopy(resolvedAddress)}
                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-primary transition-all focus:outline-none"
                title="Copy Address"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <WalletQRDialog address={resolvedAddress} label={wallet.walletClientType} />
            </div>
          )}
        </div>
      </div>
      <div className="text-right text-primary">
        <Balance wallet={wallet} address={resolvedAddress} />
      </div>
    </div>
  );
};

const LinkedWalletRow = ({ account }: { account: any }) => {
  const { toast } = useToast();
  const address = account.address as string | undefined;

  const truncateAddress = (addr: string) => {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const handleCopy = (addr: string) => {
    navigator.clipboard.writeText(addr).then(() => {
      toast({
        title: "Copied!",
        description: "Address copied to clipboard",
        duration: 2000,
      });
    }).catch(() => { });
  };

  return (
    <div className="flex justify-between items-center p-5 rounded-2xl bg-background/40 hover:bg-background/60 border border-border/40 hover:border-primary/20 transition-all duration-200 group shadow-sm">
      <div className="flex-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1 opacity-70 group-hover:opacity-100 transition-opacity">
          Linked · {account.chainType ?? account.chain ?? "Solana"}
        </p>
        <div className="flex items-center gap-2">
          <p className="font-mono text-sm font-medium">
            {address ? truncateAddress(address) : "Unknown address"}
          </p>
          {address && (
            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => handleCopy(address)}
                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-primary transition-all focus:outline-none"
                title="Copy Address"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <WalletQRDialog address={address} label="Linked Wallet" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
