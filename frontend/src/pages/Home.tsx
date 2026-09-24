import Navigation from "@/components/Navigation";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Copy, ChevronDown, QrCode, Plus, Wallet, ExternalLink, ShieldCheck, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { US_STOCK_TOKENS } from "@/config/usStockTokens";
import { RWA_TOKENS } from "@/config/rwaTokens";
import {
  getGetEquityConnection,
  fetchUserRwaHolding,
  fetchRwaAsset,
  fetchJupiterExchangeRate,
} from "@/services/getEquityService";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import { TransactionHistory } from "@/components/dashboard/TransactionHistory";
import { useTransactionHistory } from "@/hooks/useTransactionHistory";
import MCPAgentBanner from "@/components/MCPAgentBanner";

interface StockHolding {
  mint: string;
  name: string;
  symbol: string;
  amount: number;
  usdValue?: number;
  icon?: string;
  category?: string;
  url?: string;
  isRwa?: boolean;
  localValue?: number;
  localSymbol?: string;
}



const Home = () => {
  const { ready, authenticated, user } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const navigate = useNavigate();
  const hasSyncedRef = useRef(false);
  const [stocksOpen, setStocksOpen] = useState(false);
  const [stockBalances, setStockBalances] = useState<StockHolding[] | null>(null);
  const [stocksLoading, setStocksLoading] = useState(false);
  const [stocksError, setStocksError] = useState<string | null>(null);

  const { sessionToken } = usePajSession();

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

  // React Query cached transaction history
  const {
    data: txHistoryData,
    isLoading: txHistoryLoading,
    error: txHistoryError,
  } = useTransactionHistory(user?.id, primarySolanaAddress, sessionToken);

  const transactions = txHistoryData?.transactions ?? [];
  const savingsActivity = txHistoryData?.savingsActivity ?? [];
  const stockHistory = txHistoryData?.stockHistory ?? [];
  const privateMarketHistory = txHistoryData?.privateMarketHistory ?? [];
  const fiatTransactions = txHistoryData?.fiatTransactions ?? [];

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

  const fetchStocks = useCallback(
    async (forceRefresh = false) => {
      if (!primarySolanaAddress) return;
      if (!forceRefresh && stockBalances !== null) return;

      try {
        setStocksLoading(true);
        setStocksError(null);

        const amountsByMint: Record<string, number> = {};

        // 1. Fetch DAS assets for US stock tokens
        const HELIUS_DAS_URL =
          import.meta.env.VITE_HELIUS_DAS_URL ||
          import.meta.env.VITE_SOLANA_DAS_URL ||
          "";

        if (HELIUS_DAS_URL) {
          try {
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

            if (response.ok) {
              const data: any = await response.json();
              const items: any[] = data?.result?.items ?? [];

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
            }
          } catch (dasErr) {
            console.warn("Helius DAS query failed:", dasErr);
          }
        }

        // 2. Fetch RWA Private Market holdings (e.g. Dangote Petroleum Refinery IPO - DPRI)
        const rwaHoldings: StockHolding[] = [];
        const rwaConnection = getGetEquityConnection("mainnet-beta");

        await Promise.all(
          RWA_TOKENS.map(async (token) => {
            try {
              // Direct on-chain Token-2022 balance check ensures real-time accuracy with zero indexing lag
              const onChain = await fetchUserRwaHolding(
                rwaConnection,
                primarySolanaAddress,
                token.mint
              );
              const dasAmount = amountsByMint[token.mint] ?? 0;
              const finalAmount = Math.max(dasAmount, onChain.uiAmount);

              if (finalAmount > 0) {
                let unitPriceCngn = token.minBuyCostPayout && token.minBuyShares ? token.minBuyCostPayout / token.minBuyShares : 525;
                try {
                  const asset = await fetchRwaAsset(rwaConnection, token.mint);
                  if (asset?.priceCents) {
                    unitPriceCngn = Number(asset.priceCents) / 100;
                  }
                } catch {
                  // Fallback to default asset unit price
                }

                const jupRes = await fetchJupiterExchangeRate().catch(() => ({ rate: 1370, priceImpactPct: 0 }));
                const jupRate = jupRes?.rate > 0 ? jupRes.rate : 1370;

                const totalCngn = finalAmount * unitPriceCngn;
                const estUsd = jupRate > 0 ? totalCngn / jupRate : 0;

                rwaHoldings.push({
                  mint: token.mint,
                  name: token.name,
                  symbol: token.symbol,
                  amount: finalAmount,
                  usdValue: estUsd,
                  localValue: totalCngn,
                  localSymbol: token.payoutSymbol,
                  icon: token.icon,
                  category: token.category,
                  url: `/invest/private-market/${token.id}`,
                  isRwa: true,
                });
              }
            } catch (rwaErr) {
              console.warn(`Failed to fetch RWA holding for ${token.symbol}:`, rwaErr);
            }
          })
        );

        // 3. Process US Stock holdings
        const usHoldings: StockHolding[] = US_STOCK_TOKENS.map((token) => ({
          mint: token.mint,
          name: token.name,
          symbol: token.symbol,
          amount: amountsByMint[token.mint] ?? 0,
          url: `/invest/us-stocks/${token.symbol.toLowerCase()}`,
          isRwa: false,
        })).filter((h) => h.amount > 0);

        if (usHoldings.length > 0) {
          await Promise.all(
            usHoldings.map(async (holding) => {
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
        }

        const combined = [...rwaHoldings, ...usHoldings].sort(
          (a, b) => (b.usdValue ?? 0) - (a.usdValue ?? 0)
        );

        setStockBalances(combined);
      } catch (err: any) {
        setStocksError(err?.message ?? "Failed to load stocks portfolio");
      } finally {
        setStocksLoading(false);
      }
    },
    [primarySolanaAddress, stockBalances]
  );

  useEffect(() => {
    if (primarySolanaAddress && (stocksOpen || stockBalances === null)) {
      void fetchStocks();
    }
  }, [stocksOpen, primarySolanaAddress, fetchStocks, stockBalances]);

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

            <MCPAgentBanner />

            <div className="glass-card p-6 order-3 md:order-3">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-semibold">Stocks portfolio</h2>
                  {primarySolanaAddress && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void fetchStocks(true);
                      }}
                      disabled={stocksLoading}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
                      title="Refresh holdings"
                    >
                      <RefreshCw
                        className={`w-4 h-4 ${stocksLoading ? "animate-spin text-primary" : ""}`}
                      />
                    </button>
                  )}
                </div>
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
                  Connect a Solana wallet to see your stock and equity tokens.
                </p>
              )}

              {primarySolanaAddress && !stocksOpen && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    View balances for your tokenized US stocks and African stocks held in your
                    Solana wallet.
                  </p>
                  {stockBalances && stockBalances.length > 0 && (
                    <p className="text-xs font-medium text-primary flex items-center gap-1.5 pt-1">
                      <span className="inline-block w-2 h-2 rounded-full bg-primary" />
                      {stockBalances.length} active position{stockBalances.length > 1 ? "s" : ""} in wallet
                    </p>
                  )}
                </div>
              )}

              {primarySolanaAddress && stocksOpen && (
                <div className="space-y-4">
                  {stocksLoading && !stockBalances && (
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary" />
                      <span>Loading stock & equity balances...</span>
                    </p>
                  )}

                  {stocksError && !stocksLoading && (
                    <p className="text-sm text-red-500 break-words">{stocksError}</p>
                  )}

                  {!stocksError && (
                    <>
                      {!stockBalances?.length ? (
                        stocksLoading ? null : (
                          <p className="text-sm text-muted-foreground">
                            No supported stock or private equity tokens found in your Solana wallet.
                          </p>
                        )
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">
                            Active Stock & Equity holdings in your wallet
                          </p>
                          <ul className="space-y-2">
                            {stockBalances.slice(0, 5).map((holding) => (
                              <li
                                key={holding.mint}
                                className="flex items-center justify-between rounded-xl bg-secondary/30 hover:bg-secondary/50 p-3 text-sm cursor-pointer transition-colors border border-border/40 hover:border-border/80"
                                onClick={() => {
                                  if (holding.url) {
                                    navigate(holding.url);
                                  }
                                }}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <Avatar className="w-9 h-9 rounded-xl border border-primary/20 bg-primary/10 flex-shrink-0">
                                    <AvatarImage src={holding.icon} alt={holding.symbol} className="object-cover" />
                                    <AvatarFallback className="rounded-xl bg-primary/10 text-primary text-xs font-bold">
                                      {holding.symbol.slice(0, 2)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex flex-col min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-semibold truncate text-foreground">{holding.name}</span>
                                      {holding.category && (
                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-primary/5 text-primary border-primary/20">
                                          {holding.category}
                                        </Badge>
                                      )}
                                    </div>
                                    <span className="text-xs text-muted-foreground uppercase tracking-wide">
                                      {holding.symbol}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex flex-col text-right flex-shrink-0 ml-3">
                                  <span className="font-mono font-semibold text-foreground">
                                    {holding.amount.toLocaleString(undefined, {
                                      maximumFractionDigits: 4,
                                    })}
                                  </span>
                                  {holding.usdValue != null && (
                                    <span className="text-xs text-muted-foreground mt-0.5">
                                      ≈ ${holding.usdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
                                      {holding.localValue != null && holding.localSymbol === "cNGN" && (
                                        <span className="block text-[11px] text-muted-foreground/80">
                                          (₦{holding.localValue.toLocaleString(undefined, { maximumFractionDigits: 2 })})
                                        </span>
                                      )}
                                    </span>
                                  )}
                                </div>
                              </li>
                            ))}
                            {stockBalances.length > 5 && (
                              <li className="text-xs text-muted-foreground pt-1">
                                + {stockBalances.length - 5} more holdings
                              </li>
                            )}
                          </ul>
                        </div>
                      )}

                      <div className="pt-2 flex items-center gap-2 flex-wrap">
                        <Button
                          type="button"
                          size="sm"
                          className="rounded-full text-xs font-semibold"
                          onClick={() => navigate("/invest/us-stocks")}
                        >
                          Browse US stocks
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="rounded-full text-xs font-semibold"
                          onClick={() => navigate("/invest/private-market")}
                        >
                          Browse African stocks
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
              txLoading={txHistoryLoading}
              savingsLoading={txHistoryLoading}
              fiatLoading={txHistoryLoading}
              txError={txHistoryError ? (txHistoryError as Error).message : null}
              savingsError={null}
              fiatError={null}
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
