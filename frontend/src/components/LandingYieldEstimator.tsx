import { useEffect, useState } from "react";
import { Calculator, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePrivy } from "@privy-io/react-auth";
import { formatApy, calculateYieldAmount } from "@/utils/yieldCalculations";

interface PoolInfo {
    type: string;
    apy: number;
}

const LandingYieldEstimator = () => {
    const { login } = usePrivy();
    const [regular, setRegular] = useState<PoolInfo | null>(null);
    const [protectedPool, setProtectedPool] = useState<PoolInfo | null>(null);
    const [loading, setLoading] = useState(true);

    // Estimator States
    const [depositAmount, setDepositAmount] = useState<string>("1000");
    const [durationMonths, setDurationMonths] = useState<string>("12");
    const [selectedPool, setSelectedPool] = useState<"Regular" | "Protected">("Regular");

    useEffect(() => {
        const fetchPools = async () => {
            const apiKey = import.meta.env.VITE_LULO_API_KEY;
            if (!apiKey) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const res = await fetch("https://api.lulo.fi/v1/pool.getPools", {
                    method: "GET",
                    headers: {
                        "x-api-key": apiKey,
                        "Content-Type": "application/json",
                    },
                });

                if (res.ok) {
                    const data = await res.json();
                    const regularPool: PoolInfo | undefined = (data as any)?.regular;
                    const protectedPoolData: PoolInfo | undefined = (data as any)?.protected;
                    if (regularPool) setRegular(regularPool);
                    if (protectedPoolData) setProtectedPool(protectedPoolData);
                }
            } catch (err) {
                // Silent catch for landing page
            } finally {
                setLoading(false);
            }
        };

        fetchPools();
    }, []);

    const getSelectedApy = () => {
        // If no real APY is available yet (or loading), default to a compelling but realistic placeholder
        if (loading || !regular) {
            return selectedPool === "Regular" ? 0.08 : 0.05; // 8% and 5% fallback APY
        }

        if (selectedPool === "Regular") return regular?.apy || 0.08;
        if (selectedPool === "Protected") return protectedPool?.apy || 0.05;
        return 0;
    };

    const calculateYield = () => {
        const apy = getSelectedApy();
        const { earnings, balance } = calculateYieldAmount(depositAmount, durationMonths, apy);

        return {
            earnings,
            balance,
            apyUsed: apy,
        };
    };

    const { earnings, balance, apyUsed } = calculateYield();

    return (
        <section className="py-24 px-4 relative overflow-hidden bg-background/50">
            <div className="max-w-6xl mx-auto relative z-10 flex flex-col md:flex-row gap-12 items-center">

                {/* Narrative Side */}
                <div className="flex-1 space-y-6">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-primary/5">
                        <TrendingUp className="w-4 h-4 text-primary" />
                        <span className="text-sm text-foreground font-medium">Estimate Your Returns</span>
                    </div>
                    <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
                        See exactly how <span className="gradient-text">much you could earn</span>
                    </h2>
                    <p className="text-lg text-muted-foreground">
                        Don't leave money on the table. With our battle-tested smart routing, your USDC earns the highest available yields securely. Compare our regular and protected vaults and see the power of compound interest working for you.
                    </p>
                    <ul className="space-y-3 pt-4 border-t border-border/50">
                        <li className="flex items-center gap-3 text-muted-foreground">
                            <span className="h-2 w-2 rounded-full bg-primary" />
                            Dynamic auto-routing for highest yields
                        </li>
                        <li className="flex items-center gap-3 text-muted-foreground">
                            <span className="h-2 w-2 rounded-full bg-primary" />
                            No lock-up periods, withdraw anytime
                        </li>
                        <li className="flex items-center gap-3 text-muted-foreground">
                            <span className="h-2 w-2 rounded-full bg-primary" />
                            Real-time compound interest
                        </li>
                    </ul>
                </div>

                {/* Interactive Calculator Side */}
                <div className="flex-1 w-full max-w-lg">
                    <div className="glass-card p-6 md:p-8 rounded-2xl border border-primary/20 shadow-2xl relative">
                        <div className="absolute -inset-0.5 bg-gradient-to-br from-primary/30 to-accent/30 rounded-3xl blur opacity-20 -z-10" />

                        <div className="flex items-center gap-2 mb-6">
                            <Calculator className="w-6 h-6 text-primary" />
                            <h3 className="text-2xl font-semibold">Yield Estimator</h3>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">
                                    Deposit Amount (USD)
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                    <input
                                        type="number"
                                        min="0"
                                        value={depositAmount}
                                        onChange={(e) => setDepositAmount(e.target.value)}
                                        className="flex h-12 w-full rounded-xl border border-input bg-background/50 pl-8 pr-3 py-2 text-md ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors font-medium border-primary/30 focus:border-primary/50"
                                        placeholder="1000"
                                    />
                                </div>
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
                                    className="flex h-12 w-full rounded-xl border border-input bg-background/50 px-3 py-2 text-md ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors font-medium border-primary/30 focus:border-primary/50"
                                    placeholder="12"
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="text-sm font-medium text-foreground flex justify-between">
                                    <span>Strategy</span>
                                    <span className="text-primary">{formatApy(apyUsed)} APY</span>
                                </label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedPool("Regular")}
                                        className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all ${selectedPool === "Regular"
                                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 border-transparent"
                                            : "bg-background border border-border text-muted-foreground hover:bg-secondary/50"
                                            }`}
                                    >
                                        Regular Vault
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedPool("Protected")}
                                        className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all ${selectedPool === "Protected"
                                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 border-transparent"
                                            : "bg-background border border-border text-muted-foreground hover:bg-secondary/50"
                                            }`}
                                    >
                                        Protected Vault
                                    </button>
                                </div>
                            </div>

                            <div className="bg-primary/10 border border-primary/20 rounded-xl p-5 mt-6 flex justify-between items-center group relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />

                                <div>
                                    <p className="text-sm text-muted-foreground font-medium mb-1">Projected Earnings</p>
                                    <p className="text-3xl font-bold text-green-500 tracking-tight">
                                        +${earnings}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-muted-foreground font-medium mb-1">Total Balance</p>
                                    <p className="text-xl font-bold text-foreground">
                                        ${balance}
                                    </p>
                                </div>
                            </div>

                            <div className="pt-2">
                                <Button
                                    onClick={() => login()}
                                    className="w-full h-12 text-lg font-semibold bg-primary hover:opacity-90 transition-opacity"
                                >
                                    Start Earning Now
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default LandingYieldEstimator;
