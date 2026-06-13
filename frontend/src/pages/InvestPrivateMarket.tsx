import Navigation from "@/components/Navigation";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const PRIVATE_MARKET_ITEMS = [
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

        <div className="glass-card p-6 sm:p-8 rounded-2xl space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Private Market
            </h1>
            <p className="text-sm text-muted-foreground">
              Browse exclusive private market investment opportunities.
            </p>
          </div>

          <div className="space-y-3">
            {PRIVATE_MARKET_ITEMS.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No private market opportunities available at the moment.
              </p>
            ) : (
              <ul className="space-y-3">
                {PRIVATE_MARKET_ITEMS.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center gap-3 rounded-xl bg-secondary/40 border border-border/60 px-4 py-4 cursor-pointer hover:bg-secondary/60 transition-colors"
                    onClick={() => navigate(`/invest/private-market/${item.id}`)}
                  >
                    <div className="flex-shrink-0 w-12 h-12 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center text-primary text-xl font-semibold">
                      {item.provider.slice(0, 1)}
                    </div>
                    <div className="flex-1 min-w-0 w-full">
                      <p className="text-base font-semibold truncate">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.provider} &bull; {item.location}
                      </p>
                    </div>
                    <div className="text-left sm:text-right w-full sm:w-auto mt-2 sm:mt-0">
                      <p className="text-sm font-semibold text-primary">{item.roi} ROI</p>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">
                        {item.type}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default InvestPrivateMarket;
