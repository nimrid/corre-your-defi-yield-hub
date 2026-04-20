import Navigation from "@/components/Navigation";
import TradingViewWidget from "@/components/TradingViewWidget";
import { ArrowLeft, Copy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { usePrivy } from "@privy-io/react-auth";
import {
  useWallets as useSolanaWallets,
  useSignTransaction,
} from "@privy-io/react-auth/solana";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { apiFetch } from "@/services/apiClient";

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
  decimals?: number | null;
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

// Helpers to handle base64 in the browser without relying on Node's Buffer
const base64ToUint8Array = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

const uint8ArrayToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const InvestStockDetails = () => {
  const { mint } = useParams<{ mint: string }>();
  const navigate = useNavigate();
  const { user } = usePrivy();
  const [token, setToken] = useState<TokenDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { wallets } = useSolanaWallets();
  const { signTransaction } = useSignTransaction();
  const [userShares, setUserShares] = useState<string | null>(null);
  const [sharesLoading, setSharesLoading] = useState(false);
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);

  const [buyOpen, setBuyOpen] = useState(false);
  const [usdcInput, setUsdcInput] = useState<string>("");
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [outAmount, setOutAmount] = useState<string | null>(null); // display string
  const [outAmountRaw, setOutAmountRaw] = useState<string | null>(null); // raw numeric for DB
  const [requestId, setRequestId] = useState<string | null>(null);
  const [unsignedTx, setUnsignedTx] = useState<string | null>(null);
  const [lastValidBlockHeight, setLastValidBlockHeight] = useState<string | null>(null);
  const [executeLoading, setExecuteLoading] = useState(false);
  const [executeError, setExecuteError] = useState<string | null>(null);
  const [executeSuccess, setExecuteSuccess] = useState<string | null>(null);

  const [sellOpen, setSellOpen] = useState(false);
  const [sellInput, setSellInput] = useState<string>("");
  const [sellQuoteLoading, setSellQuoteLoading] = useState(false);
  const [sellQuoteError, setSellQuoteError] = useState<string | null>(null);
  const [sellOutUsdc, setSellOutUsdc] = useState<string | null>(null); // display string
  const [sellOutUsdcRaw, setSellOutUsdcRaw] = useState<string | null>(null); // raw numeric for DB
  const [sellRequestId, setSellRequestId] = useState<string | null>(null);
  const [sellUnsignedTx, setSellUnsignedTx] = useState<string | null>(null);
  const [sellLastValidBlockHeight, setSellLastValidBlockHeight] = useState<string | null>(null);
  const [sellExecuteLoading, setSellExecuteLoading] = useState(false);
  const [sellExecuteError, setSellExecuteError] = useState<string | null>(null);
  const [sellExecuteSuccess, setSellExecuteSuccess] = useState<string | null>(null);

  // Debug: log available Solana wallets in development only
  if (import.meta.env.DEV) {
    // This runs on render; keep it lightweight
    // eslint-disable-next-line no-console
    console.debug("[InvestStockDetails] Solana wallets", wallets);
  }

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
          decimals: typeof first.decimals === "number" ? first.decimals : null,
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

  // Fetch user's holdings for this stock (from backend DB) and their USDC balance using their Privy Solana wallet
  useEffect(() => {
    const fetchHoldings = async () => {
      try {
        if (!token || !user?.id) return;

        setSharesLoading(true);

        // 1) Fetch net shares for this stock from backend (purchases minus sales)
        try {
          const res = await apiFetch(`/stock-holdings/${user.id}`);
          if (res.ok) {
            const rows: Array<{ stockMint: string; shares: string }> = await res.json();
            const mintKey = mint ?? token.address;
            const match = rows.find(
              (row) =>
                row.stockMint === mintKey ||
                row.stockMint === token.address,
            );
            setUserShares(match ? match.shares : null);
          } else {
            setUserShares(null);
          }
        } catch {
          setUserShares(null);
        }

        // 2) Fetch USDC balance via Alchemy RPC to display the actual wallet balance
        let ownerAddress: string | undefined;

        const solWallet = wallets.find(
          (w: any) =>
            w.walletClientType === "solana" ||
            w.chainType === "solana" ||
            w.chain === "solana"
        ) as any;

        if (solWallet) {
          ownerAddress = solWallet.address;
          if (!ownerAddress && typeof solWallet.getAddress === "function") {
            try {
              ownerAddress = await solWallet.getAddress();
            } catch {
              ownerAddress = undefined;
            }
          }
        }

        if (!ownerAddress && user) {
          const linkedWallets = (user.linkedAccounts ?? []).filter(
            (a: any) => a.type === "wallet" || a.type === "smart_wallet"
          );
          const linkedSolana = linkedWallets.filter(
            (a: any) => a.chainType === "solana" || a.chain === "solana"
          );
          ownerAddress = (linkedSolana[0] as any)?.address;
        }

        if (!ownerAddress) {
          setUsdcBalance(null);
          return;
        }

        try {
          const { Connection, PublicKey } = await import("@solana/web3.js");
          const connection = new Connection("https://solana-mainnet.g.alchemy.com/v2/C5-LCLXSwlCEtsquSDPIj", "confirmed");
          const owner = new PublicKey(ownerAddress);
          const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"); // Solana USDC
          
          const resp = await connection.getParsedTokenAccountsByOwner(owner, { mint: USDC_MINT });
          const ui = resp.value.reduce((sum, acc: any) => {
            const amt = acc?.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
            return sum + Number(amt || 0);
          }, 0);
          
          setUsdcBalance(Number(ui).toLocaleString(undefined, { maximumFractionDigits: 4 }));
        } catch (err) {
          console.error("Failed to fetch USDC balance via RPC", err);
          setUsdcBalance(null);
        }
      } catch {
        setUserShares(null);
      } finally {
        setSharesLoading(false);
      }
    };

    void fetchHoldings();
  }, [token, wallets, user, mint]);

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

              <div className="mt-4 rounded-xl bg-secondary/40 border border-border/60 p-3">
                <div className="text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-wide">
                  Price chart
                </div>
                <div className="h-56 sm:h-72 md:h-80 w-full">
                  <TradingViewWidget symbol={`CRYPTO:${token.symbol}USD|1D`} />
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
                    setLastValidBlockHeight(null);
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
                  onClick={() => {
                    setSellOpen(true);
                    setSellQuoteError(null);
                    setSellOutUsdc(null);
                    setSellRequestId(null);
                    setSellUnsignedTx(null);
                    setSellLastValidBlockHeight(null);
                    setSellExecuteError(null);
                    setSellExecuteSuccess(null);
                    setSellInput("");
                  }}
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
                  setLastValidBlockHeight(null);
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
                    const base = "https://api.jup.ag/swap/v2/order";
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

                    // Always parse the body so we can surface the real error message
                    const data: any = await res.json().catch(() => null);
                    // eslint-disable-next-line no-console
                    console.debug("[InvestStockDetails] Buy order response", { status: res.status, data });

                    if (!res.ok) {
                      const apiMsg =
                        data?.error ??
                        data?.message ??
                        data?.detail ??
                        `Jupiter API error ${res.status}`;
                      throw new Error(apiMsg);
                    }

                    // Surface API-level errors even on 200 OK
                    if (data?.error || data?.message) {
                      const apiMsg = data?.error ?? data?.message;
                      throw new Error(apiMsg);
                    }

                    const rawOutStr = data?.outAmount as string | undefined;
                    const tx = data?.transaction as string | undefined;
                    const reqId = data?.requestId as string | undefined;
                    // lastValidBlockHeight can come as a number or string
                    const lvbh = data?.lastValidBlockHeight != null
                      ? String(data.lastValidBlockHeight)
                      : undefined;

                    if (!rawOutStr || !tx || !reqId) {
                      setOutAmount(null);
                      setOutAmountRaw(null);
                      setRequestId(null);
                      setUnsignedTx(null);
                      setLastValidBlockHeight(null);
                      // Show which field is actually missing to help debug
                      const missing = [!rawOutStr && "outAmount", !tx && "transaction", !reqId && "requestId"]
                        .filter(Boolean).join(", ");
                      setQuoteError(`Incomplete quote response (missing: ${missing}). Token may not be tradeable via this route.`);
                      return;
                    }

                    // Use the token's actual decimals to convert from base units
                    const buyDecimals =
                      typeof token.decimals === "number" && !Number.isNaN(token.decimals)
                        ? token.decimals
                        : 6;
                    const outNumber = Number(rawOutStr) / 10 ** buyDecimals;
                    // Store locale-formatted version for display, raw numeric string for DB
                    setOutAmount(outNumber.toLocaleString(undefined, { maximumFractionDigits: 6 }));
                    setOutAmountRaw(String(outNumber)); // clean numeric, no commas
                    setUnsignedTx(tx);
                    setRequestId(reqId);
                    setLastValidBlockHeight(lvbh ?? null);
                  } catch (err: any) {
                    // Always log quote errors to the console so issues are visible
                    // eslint-disable-next-line no-console
                    console.error("[InvestStockDetails] Quote error", err);
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

                  // Resolve user's Solana wallet again for signing.
                  // Use the same pattern as in the quote step (first wallet), so we
                  // sign with the same taker wallet Jupiter used when building the tx.
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
                  const txBytes = base64ToUint8Array(unsignedTx);
                  const transaction = VersionedTransaction.deserialize(txBytes);

                  if (import.meta.env.DEV) {
                    // eslint-disable-next-line no-console
                    console.debug("[InvestStockDetails] Signing transaction", {
                      unsignedLength: txBytes.length,
                      walletAddress: takerAddress,
                    });
                  }

                  if (!signTransaction) {
                    setExecuteError("Sign transaction functionality is not available");
                    setExecuteLoading(false);
                    return;
                  }

                  // Ask Privy to sign the serialized transaction bytes (per Privy docs)
                  const serializedTx = transaction.serialize();
                  const signResult: any = await signTransaction({
                    transaction: new Uint8Array(serializedTx),
                    wallet: solWallet,
                  });

                  const signedBytes: Uint8Array =
                    signResult?.signedTransaction ?? signResult;
                  const signedBase64 = uint8ArrayToBase64(signedBytes);

                  const res = await fetch("https://api.jup.ag/swap/v2/execute", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "x-api-key": apiKey,
                    },
                    body: JSON.stringify({
                      signedTransaction: signedBase64,
                      requestId,
                      lastValidBlockHeight: lastValidBlockHeight ?? undefined,
                    }),
                  });

                  if (!res.ok) {
                    throw new Error(`Failed to execute order: ${res.status}`);
                  }
                  const execData: any = await res.json().catch(() => null);

                  if (import.meta.env.DEV) {
                    // eslint-disable-next-line no-console
                    console.debug("[InvestStockDetails] Execute response", execData);
                  }

                  setExecuteSuccess("Order submitted successfully");
                  toast.success("Trade executed successfully");

                  // Fire-and-forget call to backend to record this buy order
                  const privyUserId = user?.id;
                  if (privyUserId) {
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

                    // Log generic transaction entry for this buy
                    void apiFetch("/transactions", {
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

                    // Also record a structured stock purchase entry
                    // Use outAmountRaw (clean numeric, no commas) so parseFloat works correctly in the DB
                    void apiFetch("/stock-purchases", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        privyUserId,
                        stockMint: token?.address,
                        stockSymbol: token?.symbol,
                        stockName: token?.name,
                        usdcAmount: usdcInput,
                        sharesAmount: outAmountRaw ?? undefined, // raw numeric string, not display
                        walletAddress: ownerAddress ?? null,
                        txSignature: signature,
                        jupiterRequestId: requestId,
                        source: "invest_buy",
                      }),
                    }).catch(() => {});
                  }
                } catch (err: any) {
                  // Always log execute errors so issues are visible even outside DEV builds
                  // eslint-disable-next-line no-console
                  console.error("[InvestStockDetails] Execute error", err);
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

      {/* Sell dialog */}
      <Dialog open={sellOpen} onOpenChange={setSellOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sell {token?.symbol}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground flex items-center justify-between">
              <span>Sell shares</span>
              <span>
                Available: {sharesLoading
                  ? "Checking..."
                  : userShares != null
                  ? `${userShares} ${token?.symbol}`
                  : `0 ${token?.symbol}`}
              </span>
            </div>
            <div className="space-y-2">
              <Input
                type="number"
                min="0"
                step="0.000001"
                inputMode="decimal"
                placeholder="0.00"
                value={sellInput}
                onChange={async (e) => {
                  const value = e.target.value;
                  setSellInput(value);
                  setSellQuoteError(null);
                  setSellOutUsdc(null);
                  setSellRequestId(null);
                  setSellUnsignedTx(null);
                  setSellLastValidBlockHeight(null);
                  setSellExecuteError(null);
                  setSellExecuteSuccess(null);

                  const parsed = Number(value);
                  if (!token || !value || Number.isNaN(parsed) || parsed <= 0) {
                    return;
                  }

                  const apiKey = import.meta.env.VITE_JUP_API_KEY as string | undefined;
                  if (!apiKey) return;

                  try {
                    setSellQuoteLoading(true);

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
                      setSellQuoteError("No Solana wallet found for taker");
                      setSellQuoteLoading(false);
                      return;
                    }

                    // amount in base units for the stock token using its on-chain decimals
                    const sellDecimals =
                      typeof token.decimals === "number" && !Number.isNaN(token.decimals)
                        ? token.decimals
                        : 6;
                    const rawAmount = Math.round(parsed * 10 ** sellDecimals);
                    const base = "https://api.jup.ag/swap/v2/order";
                    const params = new URLSearchParams({
                      inputMint: token.address,
                      outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
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

                    // Always parse body to surface real error message
                    const data: any = await res.json().catch(() => null);
                    // eslint-disable-next-line no-console
                    console.debug("[InvestStockDetails] Sell order response", { status: res.status, data });

                    if (!res.ok) {
                      const apiMsg =
                        data?.error ??
                        data?.message ??
                        data?.detail ??
                        `Jupiter API error ${res.status}`;
                      throw new Error(apiMsg);
                    }

                    if (data?.error || data?.message) {
                      throw new Error(data?.error ?? data?.message);
                    }

                    const rawSellOutStr = data?.outAmount as string | undefined;
                    const tx = data?.transaction as string | undefined;
                    const reqId = data?.requestId as string | undefined;
                    // lastValidBlockHeight can be a number or string in the JSON
                    const lvbh = data?.lastValidBlockHeight != null
                      ? String(data.lastValidBlockHeight)
                      : undefined;

                    if (!rawSellOutStr || !tx || !reqId) {
                      setSellOutUsdc(null);
                      setSellOutUsdcRaw(null);
                      setSellRequestId(null);
                      setSellUnsignedTx(null);
                      setSellLastValidBlockHeight(null);
                      const missing = [!rawSellOutStr && "outAmount", !tx && "transaction", !reqId && "requestId"]
                        .filter(Boolean).join(", ");
                      setSellQuoteError(`Incomplete quote response (missing: ${missing}). Token may not be tradeable via this route.`);
                      return;
                    }

                    // outAmount is USDC in base units (6 decimals)
                    const outNumber = Number(rawSellOutStr) / 1_000_000;
                    // Store display string and raw numeric separately
                    setSellOutUsdc(outNumber.toLocaleString(undefined, { maximumFractionDigits: 6 }));
                    setSellOutUsdcRaw(String(outNumber)); // clean numeric, no commas
                    setSellUnsignedTx(tx);
                    setSellRequestId(reqId);
                    setSellLastValidBlockHeight(lvbh ?? null);
                  } catch (err: any) {
                    // eslint-disable-next-line no-console
                    console.error("[InvestStockDetails] Sell quote error", err);
                    setSellQuoteError(err?.message ?? "Failed to get sell quote");
                  } finally {
                    setSellQuoteLoading(false);
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Enter the amount of {token?.symbol} you want to sell for USDC.
              </p>
            </div>

            <div className="rounded-xl bg-secondary/40 border border-border/60 p-3 text-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Estimated USDC</span>
                <span className="font-semibold">
                  {sellQuoteLoading
                    ? "Calculating..."
                    : sellOutUsdc != null
                    ? `${sellOutUsdc} USDC`
                    : "-"}
                </span>
              </div>
              {sellQuoteError && (
                <p className="text-xs text-red-500 break-words">{sellQuoteError}</p>
              )}
              {sellExecuteError && !sellQuoteError && (
                <p className="text-xs text-red-500 break-words">{sellExecuteError}</p>
              )}
              {sellExecuteSuccess && (
                <p className="text-xs text-emerald-500 break-words">{sellExecuteSuccess}</p>
              )}
            </div>

            <Button
              type="button"
              className="w-full rounded-full font-semibold"
              disabled={!sellOutUsdc || sellQuoteLoading || sellExecuteLoading || !sellUnsignedTx || !sellRequestId}
              onClick={async () => {
                if (!sellUnsignedTx || !sellRequestId) return;

                const apiKey = import.meta.env.VITE_JUP_API_KEY as string | undefined;
                if (!apiKey) {
                  setSellExecuteError("Jupiter API key is not configured (VITE_JUP_API_KEY)");
                  return;
                }

                try {
                  setSellExecuteLoading(true);
                  setSellExecuteError(null);
                  setSellExecuteSuccess(null);

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
                    setSellExecuteError("No Solana wallet available to sign sell transaction");
                    setSellExecuteLoading(false);
                    return;
                  }

                  const { VersionedTransaction } = await import("@solana/web3.js");
                  const txBytes = base64ToUint8Array(sellUnsignedTx);
                  const transaction = VersionedTransaction.deserialize(txBytes);

                  if (import.meta.env.DEV) {
                    // eslint-disable-next-line no-console
                    console.debug("[InvestStockDetails] Signing sell transaction", {
                      unsignedLength: txBytes.length,
                      walletAddress: takerAddress,
                    });
                  }

                  if (!signTransaction) {
                    setSellExecuteError("Sign transaction functionality is not available");
                    setSellExecuteLoading(false);
                    return;
                  }

                  const serializedTx = transaction.serialize();
                  const signResult: any = await signTransaction({
                    transaction: new Uint8Array(serializedTx),
                    wallet: solWallet,
                  });

                  const signedBytes: Uint8Array =
                    signResult?.signedTransaction ?? signResult;
                  const signedBase64 = uint8ArrayToBase64(signedBytes);

                  const res = await fetch("https://api.jup.ag/swap/v2/execute", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "x-api-key": apiKey,
                    },
                    body: JSON.stringify({
                      signedTransaction: signedBase64,
                      requestId: sellRequestId,
                      lastValidBlockHeight: sellLastValidBlockHeight ?? undefined,
                    }),
                  });

                  if (!res.ok) {
                    throw new Error(`Failed to execute sell order: ${res.status}`);
                  }
                  const execData: any = await res.json().catch(() => null);

                  if (import.meta.env.DEV) {
                    // eslint-disable-next-line no-console
                    console.debug("[InvestStockDetails] Sell execute response", execData);
                  }

                  setSellExecuteSuccess("Sell order submitted successfully");
                  toast.success("Stock sold successfully");

                  const privyUserId = user?.id;
                  if (privyUserId) {
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

                    // Log generic transaction entry for this sale (incoming USDC)
                    void apiFetch("/transactions", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        privyUserId,
                        chainType: "solana",
                        assetSymbol: "USDC",
                        amount: sellOutUsdc,
                        direction: "incoming",
                        txSignature: signature,
                        fromAddress: "jupiter",
                        toAddress: ownerAddress ?? null,
                        source: "invest_sell",
                      }),
                    }).catch(() => {
                      // ignore logging errors in UI
                    });

                    // Also record a structured stock sale entry in stock_sales table
                    // Use sellInput (typed number) for shares and sellOutUsdcRaw (clean numeric) for USDC
                    void apiFetch("/stock-sales", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        privyUserId,
                        stockMint: token?.address,
                        stockSymbol: token?.symbol,
                        stockName: token?.name,
                        usdcAmount: sellOutUsdcRaw ?? sellOutUsdc, // raw numeric string for DB
                        sharesAmount: sellInput || undefined, // user-typed raw number
                        walletAddress: ownerAddress ?? null,
                        txSignature: signature,
                        jupiterRequestId: sellRequestId,
                        source: "invest_sell",
                      }),
                    }).catch(() => {});
                  }
                } catch (err: any) {
                  // eslint-disable-next-line no-console
                  console.error("[InvestStockDetails] Sell execute error", err);
                  setSellExecuteError(err?.message ?? "Failed to execute sell order");
                } finally {
                  setSellExecuteLoading(false);
                }
              }}
            >
              {sellExecuteLoading ? "Confirming..." : "Confirm sell"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InvestStockDetails;
