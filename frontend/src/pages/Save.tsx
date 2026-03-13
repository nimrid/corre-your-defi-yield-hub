import Navigation from "@/components/Navigation";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Calculator, TrendingUp } from "lucide-react";
import { formatApy, calculateYieldAmount } from "@/utils/yieldCalculations";

interface PoolInfo {
  type: string;
  apy: number;
}

const Save = () => {
  const navigate = useNavigate();
  const [regular, setRegular] = useState<PoolInfo | null>(null);
  const [protectedPool, setProtectedPool] = useState<PoolInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estimator States
  const [depositAmount, setDepositAmount] = useState<string>("1000");
  const [durationMonths, setDurationMonths] = useState<string>("12");
  const [selectedPool, setSelectedPool] = useState<"Regular" | "Protected">("Regular");

  useEffect(() => {
    const fetchPools = async () => {
      const apiKey = import.meta.env.VITE_LULO_API_KEY;
      if (!apiKey) {
        setError("Lulo API key is not configured (VITE_LULO_API_KEY)");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const res = await fetch("https://api.lulo.fi/v1/pool.getPools", {
          method: "GET",
          headers: {
            "x-api-key": apiKey,
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch pools: ${res.status}`);
        }

        const data = await res.json();
        // Adjust this based on the exact shape, but expect data.regular / data.protected
        const regularPool: PoolInfo | undefined = (data as any)?.regular;
        const protectedPoolData: PoolInfo | undefined = (data as any)?.protected;

        if (!regularPool && !protectedPoolData) {
          setError("No regular/protected pools returned from Lulo API");
        }

        if (regularPool) setRegular(regularPool);
        if (protectedPoolData) setProtectedPool(protectedPoolData);
      } catch (err: any) {
        setError(err?.message ?? "Failed to load pools");
      } finally {
        setLoading(false);
      }
    };

    fetchPools();
  }, []);

  const getSelectedApy = () => {
    if (selectedPool === "Regular") return regular?.apy || 0;
    if (selectedPool === "Protected") return protectedPool?.apy || 0;
    return 0;
  };

  const calculateYield = () => {
    const apy = getSelectedApy();
    return calculateYieldAmount(depositAmount, durationMonths, apy);
  };

  const { earnings, balance } = calculateYield();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-24 space-y-8">
        <button
          type="button"
          onClick={() => navigate("/home")}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <div className="glass-card p-6 sm:p-8 rounded-2xl space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Save
            </h1>
            <p className="text-sm text-muted-foreground">
              Available saving options to earn yields.
            </p>
          </div>

          {loading && (
            <p className="text-sm text-muted-foreground">Loading pools...</p>
          )}

          {error && !loading && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          {!loading && !error && (
            <div className="space-y-8">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="glass-card p-4 rounded-xl border border-border/60 flex flex-col justify-between">
                  <h2 className="text-lg font-semibold mb-1">Regular</h2>
                  <p className="text-sm text-muted-foreground mb-3">
                    Standard saving with variable APY.
                  </p>
                  <p className="text-2xl font-bold mb-4">
                    {formatApy(regular?.apy)}
                  </p>
                  <button
                    type="button"
                    className="mt-auto inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition"
                    onClick={() => navigate("/save/regular")}
                  >
                    Regular vault
                  </button>
                </div>

                <div className="glass-card p-4 rounded-xl border border-border/60 flex flex-col justify-between">
                  <h2 className="text-lg font-semibold mb-1">Protected</h2>
                  <p className="text-sm text-muted-foreground mb-3">
                    Protected saving option with its own APY.
                  </p>
                  <p className="text-2xl font-bold mb-4">
                    {formatApy(protectedPool?.apy)}
                  </p>
                  <button
                    type="button"
                    className="mt-auto inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition"
                    onClick={() => navigate("/save/protected")}
                  >
                    Protected vault
                  </button>
                </div>
              </div>

              {/* Yield Estimator */}
              <div className="glass-card p-6 sm:p-8 rounded-2xl border border-border/60 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                <div className="flex items-center gap-2 mb-6 text-xl font-bold">
                  <Calculator className="w-5 h-5 text-primary" />
                  <h2>Yield Estimator</h2>
                </div>

                <div className="grid gap-8 md:grid-cols-2">
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        Deposit Amount ($)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        className="flex h-11 w-full rounded-xl border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                        placeholder="1000"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        Duration (Months)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={durationMonths}
                        onChange={(e) => setDurationMonths(e.target.value)}
                        className="flex h-11 w-full rounded-xl border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                        placeholder="12"
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-medium text-foreground">
                        Select Pool
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedPool("Regular")}
                          className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all ${selectedPool === "Regular"
                            ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                            : "bg-secondary/50 text-secondary-foreground hover:bg-secondary/80"
                            }`}
                        >
                          Regular ({formatApy(regular?.apy)})
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedPool("Protected")}
                          className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all ${selectedPool === "Protected"
                            ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                            : "bg-secondary/50 text-secondary-foreground hover:bg-secondary/80"
                            }`}
                        >
                          Protected ({formatApy(protectedPool?.apy)})
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="glass-card p-6 md:p-8 rounded-2xl border border-primary/20 bg-primary/5 flex flex-col justify-center gap-6 shadow-inner">
                    <div className="flex items-center gap-2 text-primary font-medium">
                      <TrendingUp className="w-5 h-5" />
                      <h3 className="text-lg">Potential Outcome</h3>
                    </div>

                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Est. Earnings</p>
                      <p className="text-4xl font-bold text-green-500 tracking-tight">
                        +${earnings}
                      </p>
                    </div>

                    <div className="h-px w-full bg-border/50"></div>

                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Total Balance</p>
                      <p className="text-2xl font-semibold text-foreground tracking-tight">
                        ${balance}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Save;
