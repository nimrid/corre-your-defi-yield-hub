import Navigation from "@/components/Navigation";
import StockHeatmapWidget from "@/components/StockHeatmapWidget";
import { ArrowLeft, Grid3X3 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { US_STOCK_MINTS } from "@/config/usStockTokens";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface TokenItem {
  id: string;
  address: string;
  name: string;
  symbol: string;
  icon: string | null;
  usdPrice: number | null;
}

const JUP_TOKENS_URL = (() => {
  const base = "https://api.jup.ag/tokens/v2/search";
  const query = US_STOCK_MINTS.join(", ");
  const params = new URLSearchParams({ query });
  return `${base}?${params.toString()}`;
})();

const InvestUSStocks = () => {
  const navigate = useNavigate();
  const [tokens, setTokens] = useState<TokenItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [heatmapOpen, setHeatmapOpen] = useState(false);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_JUP_API_KEY as string | undefined;

    if (!apiKey) {
      setError("Jupiter API key is not configured (VITE_JUP_API_KEY)");
      setLoading(false);
      return;
    }

    const fetchTokens = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(JUP_TOKENS_URL, {
          method: "GET",
          headers: {
            "x-api-key": apiKey,
          },
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch tokens: ${res.status}`);
        }

        const data: any = await res.json();
        const items: TokenItem[] = Array.isArray(data)
          ? data.map((t: any) => ({
              id: t.id ?? t.address, // mint identifier
              address: t.address,
              name: t.name,
              symbol: t.symbol,
              icon: t.icon ?? null,
              usdPrice: typeof t.usdPrice === "number" ? t.usdPrice : null,
            }))
          : [];

        setTokens(items);
      } catch (err: any) {
        setError(err?.message ?? "Failed to load US tokenized stocks");
      } finally {
        setLoading(false);
      }
    };

    void fetchTokens();
  }, []);

  const formatPrice = (price: number | null) => {
    if (price == null || Number.isNaN(price)) return "-";
    return `$${price.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-24 space-y-8">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate("/invest")}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Invest</span>
          </button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-full text-xs sm:text-sm inline-flex items-center gap-1"
            onClick={() => setHeatmapOpen(true)}
          >
            <Grid3X3 className="w-3 h-3" />
            <span className="hidden xs:inline">Market heatmap</span>
            <span className="xs:hidden">Heatmap</span>
          </Button>
        </div>

        <div className="glass-card p-6 sm:p-8 rounded-2xl space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              US stocks
            </h1>
            <p className="text-sm text-muted-foreground">
              Browse tokenized US stocks available on Solana.
            </p>
          </div>

          {loading && (
            <p className="text-sm text-muted-foreground">Loading US stocks...</p>
          )}

          {error && !loading && (
            <p className="text-sm text-red-500 break-words">{error}</p>
          )}

          {!loading && !error && (
            <div className="space-y-3">
              {tokens.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No US tokenized stocks returned from Jupiter.
                </p>
              ) : (
                <ul className="space-y-3">
                  {tokens.map((token) => (
                    <li
                      key={token.id}
                      className="flex items-center gap-3 rounded-xl bg-secondary/40 border border-border/60 px-3 py-3 sm:px-4 sm:py-3 cursor-pointer hover:bg-secondary/60 transition-colors"
                      onClick={() => navigate(`/invest/us-stocks/${token.id}`)}
                    >
                      <div className="flex-shrink-0 w-10 h-10 rounded-full overflow-hidden bg-muted flex items-center justify-center text-xs font-semibold">
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
                        <p className="text-sm font-medium truncate">{token.name}</p>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">
                          {token.symbol}
                        </p>
                      </div>
                      <div className="text-right text-sm font-semibold whitespace-nowrap">
                        {formatPrice(token.usdPrice)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <Dialog open={heatmapOpen} onOpenChange={setHeatmapOpen}>
          <DialogContent className="max-w-4xl w-full">
            <DialogHeader>
              <DialogTitle>Global stock market heatmap</DialogTitle>
            </DialogHeader>
            <div className="mt-2 h-[60vh] sm:h-[70vh] w-full">
              <StockHeatmapWidget />
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default InvestUSStocks;
