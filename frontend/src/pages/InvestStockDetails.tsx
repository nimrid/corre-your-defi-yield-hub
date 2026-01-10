import Navigation from "@/components/Navigation";
import { ArrowLeft, Copy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets as useSolanaWallets } from "@privy-io/react-auth/solana";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface TokenStatsWindow {
  priceChange?: number | null;
  buyVolume?: number | null;
}

interface TokenDetails {
  id: string;
  address: string;
  name: string;
  symbol: string;
  icon: string | null;
  circSupply: number | null;
  totalSupply: number | null;
  mcap: number | null;
  usdPrice: number | null;
  stats5m?: TokenStatsWindow;
  stats1h?: TokenStatsWindow;
  stats6h?: TokenStatsWindow;
  stats24h?: TokenStatsWindow;
  stats7d?: TokenStatsWindow;
  stats30d?: TokenStatsWindow;
}

const buildTokenUrl = (mint: string) => {
  const base = "https://api.jup.ag/tokens/v2/search";
  const params = new URLSearchParams({ query: mint });
  return `${base}?${params.toString()}`;
};

const formatNumber = (value: number | null, opts?: Intl.NumberFormatOptions) => {
  if (value == null || Number.isNaN(value)) return "-";
  return value.toLocaleString(undefined, opts ?? { maximumFractionDigits: 2 });
};

const formatUsd = (value: number | null) => {
  if (value == null || Number.isNaN(value)) return "-";
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatPercent = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) return "-";
  return `${value.toFixed(2)}%`;
};

const InvestStockDetails = () => {
  const { mint } = useParams<{ mint: string }>();
  const navigate = useNavigate();
  const { user } = usePrivy();
  const [token, setToken] = useState<TokenDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { wallets } = useSolanaWallets();
  const [userShares, setUserShares] = useState<string | null>(null);
  const [sharesLoading, setSharesLoading] = useState(false);
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);

  const [buyOpen, setBuyOpen] = useState(false);
  const [usdcInput, setUsdcInput] = useState<string>("");
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [outAmount, setOutAmount] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [unsignedTx, setUnsignedTx] = useState<string | null>(null);
  const [executeLoading, setExecuteLoading] = useState(false);
  const [executeError, setExecuteError] = useState<string | null>(null);
  const [executeSuccess, setExecuteSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!mint) {
      setError("No stock selected");
      setLoading(false);
      return;
    }

    const apiKey = import.meta.env.VITE_JUP_API_KEY as string | undefined;
    if (!apiKey) {
      setError("Jupiter API key is not configured (VITE_JUP_API_KEY)");
      setLoading(false);
      return;
    }

    const fetchToken = async () => {
      try {
        setLoading(true);
        setError(null);

        const url = buildTokenUrl(mint);
        const res = await fetch(url, {
          method: "GET",
          headers: {
            "x-api-key": apiKey,
          },
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch token: ${res.status}`);
        }

        const data: any = await res.json();
        const first = Array.isArray(data) && data.length > 0 ? data[0] : null;
        if (!first) {
          setError("Could not find this stock on Jupiter");
          return;
        }

        const mapped: TokenDetails = {
          id: first.id ?? first.address ?? mint,
          address: first.address ?? mint,
          name: first.name,
          symbol: first.symbol,
          icon: first.icon ?? null,
          circSupply: typeof first.circSupply === "number" ? first.circSupply : null,
          totalSupply: typeof first.totalSupply === "number" ? first.totalSupply : null,
          mcap: typeof first.mcap === "number" ? first.mcap : null,
          usdPrice: typeof first.usdPrice === "number" ? first.usdPrice : null,
          stats5m: first.stats5m,
          stats1h: first.stats1h,
          stats6h: first.stats6h,
          stats24h: first.stats24h,
          stats7d: first.stats7d,
          stats30d: first.stats30d,
        };

        setToken(mapped);
      } catch (err: any) {
        setError(err?.message ?? "Failed to load stock details");
      } finally {
        setLoading(false);
      }
    };

    void fetchToken();
  }, [mint]);

  // Fetch user's holdings for this stock and their USDC balance using their Privy Solana wallet
  useEffect(() => {
    const fetchHoldings = async () => {
      try {
        if (!token) return;

        const apiKey = import.meta.env.VITE_JUP_API_KEY as string | undefined;
        if (!apiKey) return;

        // Find a Solana wallet from Privy
        const solWallet = wallets.find(
          (w: any) =>
            w.walletClientType === "solana" ||
            w.chainType === "solana" ||
            w.chain === "solana"
        ) as any;

        if (!solWallet) return;

        setSharesLoading(true);

        let ownerAddress: string | undefined = solWallet.address;
        if (!ownerAddress && typeof solWallet.getAddress === "function") {
          try {
            ownerAddress = await solWallet.getAddress();
          } catch {
            ownerAddress = undefined;
          }
        }

        if (!ownerAddress) {
          setUserShares(null);
          setSharesLoading(false);
          return;
        }

        const base = "https://api.jup.ag/ultra/v1/holdings/address";
        const params = new URLSearchParams({ address: ownerAddress });
        const url = `${base}?${params.toString()}`;

        const res = await fetch(url, {
          method: "GET",
          headers: {
            "x-api-key": apiKey,
          },
        });

        if (!res.ok) {
          setUserShares(null);
          setSharesLoading(false);
          return;
        }

        const data: any = await res.json();
        const tokens = data?.tokens ?? {};

        // Current stock holdings: try to match by id (mint) first, then by address
        const mintKey = token.id ?? token.address;
        const holdingsArray = tokens[mintKey] ?? tokens[token.address];

        if (Array.isArray(holdingsArray) && holdingsArray.length > 0) {
          const entry = holdingsArray[0];
          const uiAmountString = entry?.uiAmountString as string | undefined;
          setUserShares(uiAmountString ?? null);
        } else {
          setUserShares(null);
        }

        // USDC balance (Solana USDC)
        const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
        const usdcArray = tokens[USDC_MINT];
        if (Array.isArray(usdcArray) && usdcArray.length > 0) {
          const usdcEntry = usdcArray[0];
          const usdcUi = usdcEntry?.uiAmountString as string | undefined;
          setUsdcBalance(usdcUi ?? null);
        } else {
          setUsdcBalance(null);
        }
      } catch {
        setUserShares(null);
      } finally {
        setSharesLoading(false);
      }
    };

    void fetchHoldings();
  }, [token, wallets]);

  const statBlocks = useMemo(
    () => [
      { label: "5m", key: "stats5m" as const },
      { label: "1h", key: "stats1h" as const },
      { label: "6h", key: "stats6h" as const },
      { label: "24h", key: "stats24h" as const },
      { label: "7d", key: "stats7d" as const },
      { label: "30d", key: "stats30d" as const },
    ],
    []
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-24 space-y-6">
        <button
          type="button"
          onClick={() => navigate("/invest/us-stocks")}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to US stocks</span>
        </button>

        <div className="glass-card p-6 sm:p-8 rounded-2xl space-y-6">
          {loading && (
            <p className="text-sm text-muted-foreground">Loading stock details...</p>
          )}

          {error && !loading && (
            <p className="text-sm text-red-500 break-words">{error}</p>
          )}

          {!loading && !error && token && (
            <>
              {/* Header: icon, name, symbol, price */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-muted flex items-center justify-center text-sm font-semibold">
                  {token.icon ? (
                    <img
                      src={token.icon}
                      alt={token.symbol}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{token.symbol.slice(0, 3).toUpperCase()}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl sm:text-2xl font-bold truncate">{token.name}</h1>
                  <p className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <span>{token.symbol}</span>
                    <span className="text-[10px] sm:text-xs font-mono truncate max-w-[9rem] sm:max-w-[12rem]">
                      {token.address.slice(0, 4)}...{token.address.slice(-4)}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(token.address).catch(() => {})}
                      className="p-1 rounded hover:bg-secondary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg sm:text-2xl font-bold">{formatUsd(token.usdPrice)}</p>
                  {typeof token.mcap === "number" && (
                    <p className="text-xs text-muted-foreground">Mcap {formatUsd(token.mcap)}</p>
                  )}
                </div>
              </div>

              {/* Supply details */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="rounded-xl bg-secondary/40 border border-border/60 p-3 flex flex-col">
                  <span className="text-xs text-muted-foreground">Circulating supply</span>
                  <span className="mt-1 font-semibold">
                    {formatNumber(token.circSupply, { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="rounded-xl bg-secondary/40 border border-border/60 p-3 flex flex-col">
                  <span className="text-xs text-muted-foreground">Total supply</span>
                  <span className="mt-1 font-semibold">
                    {formatNumber(token.totalSupply, { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>

              {/* User holdings */}
              <div className="rounded-xl bg-secondary/40 border border-border/60 p-3 flex flex-col text-sm">
                <span className="text-xs text-muted-foreground">Your holdings</span>
                <span className="mt-1 font-semibold">
                  {sharesLoading
                    ? "Checking..."
                    : userShares != null
                    ? `${userShares} shares`
                    : "No shares detected"}
                </span>
              </div>

              {/* Stats section */}
              <div className="space-y-3">
                <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                  Performance
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {statBlocks.map(({ label, key }) => {
                    const windowStats = token[key];
                    const change = windowStats?.priceChange ?? null;
                    const buyVolume = windowStats?.buyVolume ?? null;

                    const isPositive = typeof change === "number" && change > 0;
                    const isNegative = typeof change === "number" && change < 0;

                    return (
                      <div
                        key={key}
                        className="rounded-xl bg-secondary/40 border border-border/60 p-3 flex flex-col gap-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground uppercase tracking-wide">
                            {label}
                          </span>
                          <span
                            className={`text-xs font-semibold ${
                              isPositive
                                ? "text-emerald-500"
                                : isNegative
                                ? "text-red-500"
                                : "text-muted-foreground"
                            }`}
                          >
                            {formatPercent(change)}
                          </span>
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          Buy volume: {formatUsd(buyVolume ?? null)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <Button
                  type="button"
                  className="flex-1 rounded-full font-semibold"
                  variant="default"
                  onClick={() => {
                    setBuyOpen(true);
                    setQuoteError(null);
                    setOutAmount(null);
                    setRequestId(null);
                    setUnsignedTx(null);
                    setExecuteError(null);
                    setExecuteSuccess(null);
                  }}
                >
                  Buy
                </Button>
                <Button
                  type="button"
                  className="flex-1 rounded-full font-semibold"
                  variant="default"
                >
                  Sell
                </Button>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Buy dialog */}
      <Dialog open={buyOpen} onOpenChange={setBuyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buy {token?.symbol}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground flex items-center justify-between">
              <span>Pay with USDC</span>
              <span>
                Available: {sharesLoading
                  ? "Checking..."
                  : usdcBalance != null
                  ? `${usdcBalance} USDC`
                  : "0 USDC"}
              </span>
            </div>
            <div className="space-y-2">
              <Input
                type="number"
                min="0"
                step="0.000001"
                inputMode="decimal"
                placeholder="0.00"
                value={usdcInput}
                onChange={async (e) => {
                  const value = e.target.value;
                  setUsdcInput(value);
                  setQuoteError(null);
                  setOutAmount(null);
                  setRequestId(null);
                  setUnsignedTx(null);
                  setExecuteError(null);
                  setExecuteSuccess(null);

                  const parsed = Number(value);
                  if (!token || !value || Number.isNaN(parsed) || parsed <= 0) {
                    return;
                  }

                  const apiKey = import.meta.env.VITE_JUP_API_KEY as string | undefined;
                  if (!apiKey) return;

                  try {
                    setQuoteLoading(true);

                    // Resolve taker (user's Solana wallet address)
                    const solWallet = wallets[0] as any;

                    let takerAddress: string | undefined = solWallet?.address;
                    if (!takerAddress && solWallet && typeof solWallet.getAddress === "function") {
                      try {
                        takerAddress = await solWallet?.getAddress();
                      } catch {
                        takerAddress = undefined;
                      }
                    }

                    if (!takerAddress) {
                      setQuoteError("No Solana wallet found for taker");
                      setQuoteLoading(false);
                      return;
                    }

                    // amount in base units (USDC has 6 decimals)
                    const rawAmount = Math.round(parsed * 1_000_000);
                    const base = "https://api.jup.ag/ultra/v1/order";
                    const params = new URLSearchParams({
                      inputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                      outputMint: token.address,
                      amount: String(rawAmount),
                      taker: takerAddress,
                    });
                    const url = `${base}?${params.toString()}`;

                    const res = await fetch(url, {
                      method: "GET",
                      headers: {
                        "x-api-key": apiKey,
                      },
                    });

                    if (!res.ok) {
                      throw new Error(`Failed to quote order: ${res.status}`);
                    }

                    const data: any = await res.json();
                    const outAmountRaw = data?.outAmount as string | undefined;
                    const tx = data?.transaction as string | undefined; // unsigned serialized tx (base64)
                    const reqId = data?.requestId as string | undefined;

                      if (!outAmountRaw) {
                      setOutAmount(null);
                      setRequestId(null);
                      return;
                    }

                    // Assume stock tokens use 6 decimals; then divide by 100 before displaying
                    const outNumber = Number(outAmountRaw) / 1_000_000 / 100;
                    setOutAmount(outNumber.toLocaleString(undefined, {
                      maximumFractionDigits: 6,
                    }));
                    setUnsignedTx(tx ?? null);
                    setRequestId(reqId ?? null);
                  } catch (err: any) {
                    setQuoteError(err?.message ?? "Failed to get quote");
                  } finally {
                    setQuoteLoading(false);
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Enter the amount of USDC you want to invest in {token?.symbol}.
              </p>
            </div>

            <div className="rounded-xl bg-secondary/40 border border-border/60 p-3 text-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Estimated shares</span>
                <span className="font-semibold">
                  {quoteLoading
                    ? "Calculating..."
                    : outAmount != null
                    ? `${outAmount} ${token?.symbol}`
                    : "-"}
                </span>
              </div>
              {quoteError && (
                <p className="text-xs text-red-500 break-words">{quoteError}</p>
              )}
              {executeError && !quoteError && (
                <p className="text-xs text-red-500 break-words">{executeError}</p>
              )}
              {executeSuccess && (
                <p className="text-xs text-emerald-500 break-words">{executeSuccess}</p>
              )}
            </div>

            <Button
              type="button"
              className="w-full rounded-full font-semibold"
              disabled={!outAmount || quoteLoading || executeLoading || !unsignedTx || !requestId}
              onClick={async () => {
                if (!unsignedTx || !requestId) return;

                const apiKey = import.meta.env.VITE_JUP_API_KEY as string | undefined;
                if (!apiKey) {
                  setExecuteError("Jupiter API key is not configured (VITE_JUP_API_KEY)");
                  return;
                }

                try {
                  setExecuteLoading(true);
                  setExecuteError(null);
                  setExecuteSuccess(null);

                  // Resolve user's Solana wallet again for signing (first Solana wallet)
                  const solWallet = wallets[0] as any;

                  let takerAddress: string | undefined = solWallet?.address;
                  if (!takerAddress && solWallet && typeof solWallet.getAddress === "function") {
                    try {
                      takerAddress = await solWallet.getAddress();
                    } catch {
                      takerAddress = undefined;
                    }
                  }

                  if (!solWallet || !takerAddress) {
                    setExecuteError("No Solana wallet available to sign transaction");
                    setExecuteLoading(false);
                    return;
                  }

                  // Decode unsigned transaction from base64 and sign with Privy Solana wallet
                  // Jupiter returns a versioned transaction, so use VersionedTransaction.deserialize
                  const { VersionedTransaction } = await import("@solana/web3.js");
                  const txBytes = Buffer.from(unsignedTx, "base64");
                  const transaction = VersionedTransaction.deserialize(txBytes);

                  if (typeof solWallet.signTransaction !== "function") {
                    setExecuteError("Wallet does not support transaction signing");
                    setExecuteLoading(false);
                    return;
                  }

                  const signedTx = await solWallet.signTransaction(transaction);
                  const signedBytes = signedTx.serialize();
                  const signedBase64 = Buffer.from(signedBytes).toString("base64");

                  const res = await fetch("https://api.jup.ag/ultra/v1/execute", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "x-api-key": apiKey,
                    },
                    body: JSON.stringify({
                      signedTransaction: signedBase64,
                      requestId,
                    }),
                  });

                  if (!res.ok) {
                    throw new Error(`Failed to execute order: ${res.status}`);
                  }
                  const execData: any = await res.json().catch(() => null);

                  setExecuteSuccess("Order submitted successfully");
                  toast.success("Trade executed successfully");

                  // Fire-and-forget call to backend to record this buy order
                  const privyUserId = user?.id;
                  if (privyUserId) {
                    try {
                      // Resolve a Solana wallet/address for the user
                      const solWallet = wallets.find(
                        (w: any) =>
                          w.walletClientType === "solana" ||
                          w.chainType === "solana" ||
                          w.chain === "solana"
                      ) as any;

                      let ownerAddress: string | undefined = solWallet?.address;
                      if (!ownerAddress && solWallet && typeof solWallet.getAddress === "function") {
                        try {
                          ownerAddress = await solWallet.getAddress();
                        } catch {
                          ownerAddress = undefined;
                        }
                      }

                      const signature =
                        (execData as any)?.signature ??
                        (execData as any)?.txid ??
                        null;

                      void fetch("http://localhost:4000/transactions", {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          privyUserId,
                          chainType: "solana",
                          assetSymbol: token?.symbol ?? "USDC",
                          amount: usdcInput,
                          direction: "incoming",
                          txSignature: signature,
                          fromAddress: "jupiter",
                          toAddress: ownerAddress ?? null,
                          source: "invest_buy",
                        }),
                      }).catch(() => {
                        // ignore logging errors in UI
                      });
                    } catch {
                      // Swallow db logging errors to avoid breaking UX
                    }
                  }
                } catch (err: any) {
                  setExecuteError(err?.message ?? "Failed to execute order");
                } finally {
                  setExecuteLoading(false);
                }
              }}
            >
              {executeLoading ? "Confirming..." : "Confirm buy"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InvestStockDetails;
