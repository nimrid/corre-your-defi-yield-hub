import Navigation from "@/components/Navigation";
import { ArrowLeft, Sparkles, Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { RWA_TOKENS, type RwaTokenConfig } from "@/config/rwaTokens";
import { fetchRwaAsset, getGetEquityConnection } from "@/services/getEquityService";
import { Badge } from "@/components/ui/badge";

const LEGACY_PRIVATE_ITEMS = [
  {
    id: "nilep-palm-oil",
    name: "Palm Oil Mill Operations",
    provider: "Nilep",
    location: "Cross River State, Nigeria",
    roi: "10% - 15% fixed",
    type: "Agriculture",
  },
];

const InvestPrivateMarket = () => {
  const navigate = useNavigate();
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});

  // Fetch live on-chain prices for RWA assets
  useEffect(() => {
    let isMounted = true;
    const connection = getGetEquityConnection();

    const loadPrices = async () => {
      const prices: Record<string, number> = {};
      for (const token of RWA_TOKENS) {
        try {
          const asset = await fetchRwaAsset(connection, token.mint);
          if (asset && isMounted) {
            prices[token.id] = asset.priceUSD;
          }
        } catch (err) {
          console.error(`Failed to fetch on-chain price for ${token.symbol}:`, err);
        }
      }
      if (isMounted) setLivePrices(prices);
    };

    void loadPrices();
    return () => {
      isMounted = false;
    };
  }, []);

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
        </div>

        <div className="glass-card p-6 sm:p-8 rounded-2xl space-y-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Private Market &amp; RWAs
              </h1>
              <Badge variant="secondary" className="gap-1 text-xs">
                <Sparkles className="w-3 h-3 text-primary" />
                <span>On-Chain</span>
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Invest in tokenized real-world assets, private credit, and institutional dealrooms settled on Solana.
            </p>
          </div>

          {/* Section 1: On-Chain RWA Assets (GetEquity) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                Tokenized Real-World Assets (GetEquity)
              </h2>
              <span className="text-xs text-muted-foreground">Instant Settlement on Solana</span>
            </div>

            <ul className="space-y-3">
              {RWA_TOKENS.map((token: RwaTokenConfig) => {
                const livePrice = livePrices[token.id];
                const currPrefix = token.payoutSymbol === "cNGN" ? "₦" : "$";

                return (
                  <li
                    key={token.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-xl bg-secondary/40 border border-border/60 p-4 cursor-pointer hover:bg-secondary/60 hover:border-primary/40 transition-all"
                    onClick={() => navigate(`/invest/private-market/${token.id}`)}
                  >
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl overflow-hidden bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-lg font-bold">
                      {token.symbol.slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0 w-full space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-base font-semibold truncate text-foreground">{token.name}</p>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                          {token.symbol}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/20">
                          Solana Mainnet
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Building2 className="w-3 h-3" />
                        <span>{token.issuer}</span>
                        {token.location && <span>&bull; {token.location}</span>}
                      </p>
                    </div>
                    <div className="text-left sm:text-right w-full sm:w-auto mt-2 sm:mt-0 flex sm:flex-col justify-between items-end">
                      <p className="text-base font-bold text-primary">
                        {livePrice !== undefined
                          ? `${currPrefix}${livePrice.toFixed(2)} ${token.payoutSymbol}`
                          : "Loading..."}
                      </p>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">
                        {token.category}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Section 2: Private Ventures / Off-Chain Projects */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                Private Venture Syndicates
              </h2>
            </div>

            <ul className="space-y-3">
              {LEGACY_PRIVATE_ITEMS.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-xl bg-secondary/30 border border-border/40 p-4 cursor-pointer hover:bg-secondary/50 transition-colors"
                  onClick={() => navigate(`/invest/private-market/${item.id}`)}
                >
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl overflow-hidden bg-muted flex items-center justify-center text-muted-foreground text-lg font-semibold">
                    {item.provider.slice(0, 1)}
                  </div>
                  <div className="flex-1 min-w-0 w-full space-y-1">
                    <p className="text-base font-semibold truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.provider} &bull; {item.location}
                    </p>
                  </div>
                  <div className="text-left sm:text-right w-full sm:w-auto mt-2 sm:mt-0">
                    <p className="text-sm font-semibold text-emerald-500">{item.roi} ROI</p>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      {item.type}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
};

export default InvestPrivateMarket;
