import Navigation from "@/components/Navigation";
import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { apiFetch } from "@/services/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Gift, ArrowRight, UserPlus, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type Action = {
  actionType: string;
  points: number;
};

type Fren = {
  name: string;
  joinDate: string;
  actions: Action[];
};

type ReferralData = {
  referralCode: string;
  totalPoints: number;
  frens: Fren[];
};

const ACTION_LABELS: Record<string, string> = {
  SIGNUP: "Sign Up",
  DEPOSIT_SHIELDED: "Deposit Shielded Save",
  DEPOSIT_STANDARD: "Deposit Standard Save",
  BUY_US_STOCK: "Buy US Stocks",
  BUY_PRIVATE_MARKET: "Buy Private Market",
};

const Referrals = () => {
  const { ready, authenticated, user } = usePrivy();
  const { toast } = useToast();
  
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!ready || !authenticated || !user?.id) return;

      try {
        setLoading(true);
        const res = await apiFetch(`/users/${user.id}/referral`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error("Error fetching referral data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [ready, authenticated, user?.id]);



  const copyLink = () => {
    if (!data) return;
    const link = `${window.location.origin}/r/${data.referralCode}`;
    navigator.clipboard.writeText(link);
    toast({ title: "Copied!", description: "Referral link copied to clipboard." });
  };

  if (!ready || !authenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-primary" />
          <div className="w-4 h-4 rounded-full bg-primary animation-delay-200" />
          <div className="w-4 h-4 rounded-full bg-primary animation-delay-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <Navigation />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Referrals</h1>
          <p className="text-muted-foreground">Invite your frens and earn points for their actions.</p>
        </div>

        {loading ? (
          <div className="animate-pulse space-y-8">
            <div className="h-32 bg-secondary/30 rounded-2xl" />
            <div className="h-64 bg-secondary/30 rounded-2xl" />
          </div>
        ) : data ? (
          <>
            {/* Top Cards: Points and Link */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Points Card */}
              <div className="glass-card p-6 rounded-2xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-50" />
                <div className="relative z-10 flex flex-col h-full justify-between">
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-4">
                      <Gift className="w-3.5 h-3.5" />
                      Total Points
                    </div>
                    <div className="text-5xl font-black text-foreground">
                      {data.totalPoints}
                    </div>
                  </div>
                  <div className="mt-6 flex items-center gap-2 text-sm text-primary font-medium">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                    </span>
                    Redemption is coming soon
                  </div>
                </div>
              </div>

              {/* Link Card */}
              <div className="glass-card p-6 rounded-2xl border border-border/50 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Your Referral Link</h2>
                  </div>

                  <div className="p-4 rounded-xl bg-secondary/30 border border-border/40 font-mono text-sm break-all">
                    {window.location.origin}/r/{data.referralCode}
                  </div>
                </div>

                <Button className="w-full mt-6 rounded-xl gap-2 font-semibold" onClick={copyLink}>
                  <Copy className="w-4 h-4" />
                  Copy Link
                </Button>
              </div>
            </div>

            {/* Frens List */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary" />
                Your Frens ({data.frens.length})
              </h2>

              {data.frens.length === 0 ? (
                <div className="glass-card p-12 rounded-2xl text-center border border-border/50">
                  <div className="w-12 h-12 rounded-full bg-secondary/50 flex items-center justify-center mx-auto mb-4">
                    <UserPlus className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium">No frens yet</h3>
                  <p className="text-muted-foreground mt-2">
                    Share your referral link to start earning points.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {data.frens.map((fren, idx) => (
                    <div key={idx} className="glass-card p-5 rounded-2xl border border-border/50 space-y-4">
                      <div className="flex items-center justify-between border-b border-border/40 pb-4">
                        <div>
                          <div className="font-semibold text-lg">{fren.name}</div>
                          <div className="text-sm text-muted-foreground mt-0.5">
                            Joined {format(new Date(fren.joinDate), "MMM d, yyyy")}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground">Earned</div>
                          <div className="font-bold text-primary">
                            {fren.actions.reduce((acc, act) => acc + act.points, 0)} pts
                          </div>
                        </div>
                      </div>

                      {fren.actions.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {fren.actions.map((act, i) => (
                            <div 
                              key={i}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/40 text-sm font-medium border border-border/50"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                              <span>{ACTION_LABELS[act.actionType] || act.actionType}</span>
                              <span className="text-primary font-bold ml-1">+{act.points}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground italic">
                          No actions completed yet.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            Failed to load referral data.
          </div>
        )}
      </main>
    </div>
  );
};

export default Referrals;
