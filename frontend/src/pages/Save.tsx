import Navigation from "@/components/Navigation";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

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

  const formatApy = (apy?: number | null) => {
    if (typeof apy !== "number") return "-";
    return `${(apy * 100).toFixed(2)}%`;
  };

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
              Available saving options powered by Lulo.
            </p>
          </div>

          {loading && (
            <p className="text-sm text-muted-foreground">Loading pools...</p>
          )}

          {error && !loading && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          {!loading && !error && (
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
          )}
        </div>
      </main>
    </div>
  );
};

export default Save;
