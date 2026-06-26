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
import { fetchTokensAsset } from "@/services/tokensService";
import { getAllTransactions } from "paj_ramp";
import type { PajTransaction } from "paj_ramp";
import { usePajSession } from "@/hooks/usePajSession";

import { TotalBalance } from "@/components/dashboard/BalanceComponents";
import { WalletRow, LinkedWalletRow } from "@/components/dashboard/WalletComponents";
import { TransactionHistory, TransactionRow, StockHistoryRow, SavingsActivityRow } from "@/components/dashboard/TransactionHistory";

interface StockHolding {
  mint: string;
  name: string;
  symbol: string;
  amount: number;
  usdValue?: number;
}



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
  const [privateMarketHistory, setPrivateMarketHistory] = useState<any[]>([]);
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

        // Fetch prices to estimate USDC value
        if (holdings.length > 0) {
          try {
            await Promise.all(
              holdings.map(async (holding) => {
                try {
                  const asset = await fetchTokensAsset(holding.mint);
                  if (asset.price != null) {
                    holding.usdValue = holding.amount * asset.price;
                  }
                } catch (e) {
                  console.warn(`Failed to fetch price for ${holding.symbol}`, e);
                }
              })
            );
          } catch (e) {
            console.error("Error fetching holding prices", e);
          }
        }

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

    const fetchPrivateMarketHistory = async () => {
      if (!user?.id) return;
      try {
        const res = await apiFetch(`/investments/private-market/history/${user.id}`);
        if (res.ok) {
          const data = await res.json();
          setPrivateMarketHistory(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Failed to fetch private market history", err);
      }
    };

    if (ready && authenticated && user) {
      void fetchTransactions();
      void fetchSavingsActivity();
      void fetchStockHistory();
      void fetchPrivateMarketHistory();
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
                            Top Stocks holdings in your wallet and current value
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
                                <div className="flex flex-col text-right">
                                  <span className="font-mono">
                                    {holding.amount.toLocaleString(undefined, {
                                      maximumFractionDigits: 4,
                                    })}
                                  </span>
                                  {holding.usdValue != null && (
                                    <span className="text-xs text-muted-foreground mt-0.5">
                                      ≈ ${holding.usdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
                                    </span>
                                  )}
                                </div>
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
            </div>            {/* Transaction History */}
            <TransactionHistory 
              transactions={transactions}
              savingsActivity={savingsActivity}
              stockHistory={stockHistory}
              fiatTransactions={fiatTransactions}
              privateMarketHistory={privateMarketHistory}
              txLoading={txLoading}
              savingsLoading={savingsLoading}
              fiatLoading={fiatLoading}
              txError={txError}
              savingsError={savingsError}
              fiatError={fiatError}
            />
          </div>
        </div>
      </main>
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-full px-4 sm:px-0">
        <div className="max-w-md mx-auto flex gap-3 rounded-full bg-background/95 border border-border/80 shadow-xl px-4 sm:px-8 py-3 sm:py-4">
          <button
            className="flex-1 text-sm sm:text-base font-semibold px-3 py-2 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition"
            type="button"
            onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); navigate('/home'); }}
          >
            Home
          </button>
          <button
            className="flex-1 text-sm sm:text-base font-medium px-3 py-2 rounded-full hover:bg-secondary transition-colors"
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

export default Home;
