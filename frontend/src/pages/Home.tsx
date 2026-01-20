import Navigation from "@/components/Navigation";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Copy, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { US_STOCK_TOKENS } from "@/config/usStockTokens";

const API_BASE_URL =
  import.meta.env.VITE_BACKEND_URL ||
  "http://localhost:4000";

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

const Home = () => {
  const { ready, authenticated, user } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const navigate = useNavigate();
  const hasSyncedRef = useRef(false);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [stockHistory, setStockHistory] = useState<StockHistoryRow[]>([]);
  const [stockHistoryLoading, setStockHistoryLoading] = useState(false);
  const [stockHistoryError, setStockHistoryError] = useState<string | null>(null);
  const [stocksOpen, setStocksOpen] = useState(false);
  const [stockBalances, setStockBalances] = useState<StockHolding[] | null>(null);
  const [stocksLoading, setStocksLoading] = useState(false);
  const [stocksError, setStocksError] = useState<string | null>(null);

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
        };

        await fetch(`${API_BASE_URL}/users/upsert`, {
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

        const res = await fetch(`${API_BASE_URL}/transactions/${user.id}`);
        if (!res.ok) {
          throw new Error("Failed to fetch transactions");
        }

        const data = await res.json();
        setTransactions(Array.isArray(data) ? data : []);
      } catch (err: any) {
        setTxError(err?.message ?? "Failed to load transactions");
      } finally {
        setTxLoading(false);
      }
    };

    const fetchStockHistory = async () => {
      if (!user?.id) return;

      try {
        setStockHistoryLoading(true);
        setStockHistoryError(null);

        const res = await fetch(`${API_BASE_URL}/stock-history/${user.id}`);
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
      void fetchStockHistory();
    }
  }, [ready, authenticated, user]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <h1 className="text-4xl font-bold tracking-tight mb-8">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-8">
            {/* Wallets */}
            <div className="glass-card p-6">
              <h2 className="text-2xl font-semibold mb-4">Wallets</h2>
              <div className="space-y-4">
                {!walletsReady ? (
                  <p className="text-sm text-muted-foreground">Loading wallets...</p>
                ) : (
                  <>
                    <details className="rounded-lg bg-secondary/30 p-4" open>
                      <summary className="cursor-pointer font-semibold">Solana Wallets</summary>
                      <div className="mt-4 space-y-3">
                        {solanaWallets.length || linkedSolana.length ? (
                          <>
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
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground">No Solana wallets connected</p>
                        )}
                      </div>
                    </details>

                    <details className="rounded-lg bg-secondary/30 p-4">
                      <summary className="cursor-pointer font-semibold">Ethereum Wallets</summary>
                      <div className="mt-4 space-y-3">
                        {ethereumWallets.length || linkedEthereum.length ? (
                          <>
                            {ethereumWallets.map((wallet) => (
                              <WalletRow
                                key={(wallet as any).id ?? wallet.address ?? Math.random()}
                                wallet={wallet}
                              />
                            ))}
                            {linkedEthereum
                              .filter(
                                (a: any) =>
                                  !ethereumWallets.some(
                                    (w) => w.address && w.address === a.address
                                  )
                              )
                              .map((a: any, idx: number) => (
                                <LinkedWalletRow
                                  key={`linked-eth-${idx}-${a.address}`}
                                  account={a}
                                />
                              ))}
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground">No Ethereum wallets connected</p>
                        )}
                      </div>
                    </details>
                  </>
                )}
              </div>
            </div>

            {/* Balance summary comes before history on mobile */}
            <div className="glass-card p-6 order-2 md:order-2">
              <h2 className="text-2xl font-semibold mb-4">Balance</h2>
              {/* Include both connected and linked wallets when computing total */}
              <TotalBalance wallets={[...wallets, ...linkedSolana, ...linkedEthereum]} />
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
              {txLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Loading transactions...</p>
                </div>
              ) : txError ? (
                <div className="text-center py-8 text-red-500 text-sm">
                  <p>{txError}</p>
                </div>
              ) : !transactions.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No transactions yet.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg bg-secondary/30 text-sm"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={
                              tx.direction === "incoming"
                                ? "text-emerald-500 font-semibold"
                                : "text-red-500 font-semibold"
                            }
                          >
                            {tx.direction === "incoming" ? "Received" : "Sent"}
                          </span>
                          <span className="font-mono">
                            {tx.amount} {tx.assetSymbol}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground break-all">
                          <div>
                            <span className="font-medium">From:</span> {tx.fromAddress}
                          </div>
                          <div>
                            <span className="font-medium">To:</span> {tx.toAddress}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 sm:mt-0 sm:text-right text-xs text-muted-foreground space-y-1">
                        <div>
                          {new Date(tx.createdAt).toLocaleString(undefined, {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </div>
                        <div className="uppercase tracking-wide">
                          {tx.chainType}
                        </div>
                        {tx.txSignature && (
                          <div className="truncate max-w-[14rem]">
                            <span className="font-medium">Tx:</span> {tx.txSignature}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 border-t border-border/60 pt-4">
                <h3 className="text-lg font-semibold mb-3">Stock trades</h3>
                {stockHistoryLoading ? (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    <p>Loading stock trades...</p>
                  </div>
                ) : stockHistoryError ? (
                  <div className="text-center py-4 text-red-500 text-sm">
                    <p>{stockHistoryError}</p>
                  </div>
                ) : !stockHistory.length ? (
                  <p className="text-sm text-muted-foreground">No stock trades yet.</p>
                ) : (
                  <div className="space-y-3 max-h-72 overflow-y-auto">
                    {stockHistory.map((tx) => (
                      <div
                        key={`${tx.side}-${tx.id}-${tx.txSignature ?? "no-tx"}`}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg bg-secondary/30 text-sm"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={
                                tx.side === "buy"
                                  ? "text-emerald-500 font-semibold"
                                  : "text-red-500 font-semibold"
                              }
                            >
                              {tx.side === "buy" ? "Bought" : "Sold"}
                            </span>
                            <span className="font-mono">
                              {tx.sharesAmount ?? "-"} {tx.stockSymbol ?? "STOCK"}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground break-all">
                            <div>
                              <span className="font-medium">Stock:</span>{" "}
                              {tx.stockName ?? tx.stockSymbol ?? tx.stockMint}
                            </div>
                            <div>
                              <span className="font-medium">USDC:</span>{" "}
                              {tx.usdcAmount}
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 sm:mt-0 sm:text-right text-xs text-muted-foreground space-y-1">
                          <div>
                            {new Date(tx.createdAt).toLocaleString(undefined, {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </div>
                          {tx.txSignature && (
                            <div className="truncate max-w-[14rem]">
                              <span className="font-medium">Tx:</span> {tx.txSignature}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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

  return <p className="text-2xl font-bold">{total}</p>;
};

export default Home;

const WalletRow = ({ wallet }: { wallet: any }) => {
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
      } catch {}
      // Fallbacks
      try {
        if (mounted && wallet.address) setResolvedAddress(wallet.address);
      } catch {}
    };
    resolve();
    return () => { mounted = false; };
  }, [wallet]);

  return (
    <div className="flex justify-between items-center p-4 rounded-lg bg-secondary/30">
      <div>
        <p className="text-sm text-muted-foreground">{wallet.walletClientType} · {wallet.chainType}{wallet.chainId ? ` · chainId ${wallet.chainId}` : ''}</p>
        <div className="flex items-center gap-2">
          <p className="font-mono break-all">{resolvedAddress ?? 'Resolving address...'}</p>
          {resolvedAddress && (
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(resolvedAddress).catch(() => {})}
              className="p-1 rounded hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <Copy className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <Balance wallet={wallet} address={resolvedAddress} />
    </div>
  );
};

const LinkedWalletRow = ({ account }: { account: any }) => {
  const address = account.address as string | undefined;

  return (
    <div className="flex justify-between items-center p-4 rounded-lg bg-secondary/30">
      <div>
        <p className="text-sm text-muted-foreground">Linked · {account.chainType ?? account.chain ?? "unknown"}</p>
        <div className="flex items-center gap-2">
          <p className="font-mono break-all">{address ?? "Unknown address"}</p>
          {address && (
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(address).catch(() => {})}
              className="p-1 rounded hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <Copy className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
