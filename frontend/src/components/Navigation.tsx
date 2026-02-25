import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Link } from "react-router-dom";
import { Copy, Users } from "lucide-react";
import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const API_BASE_URL =
  import.meta.env.VITE_BACKEND_URL ||
  "http://localhost:4000";

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { ready, authenticated, login, logout, user } = usePrivy();
  const [referralData, setReferralData] = useState<{ referralCode: string; referralsCount: number } | null>(null);
  const [referralLoading, setReferralLoading] = useState(false);

  useEffect(() => {
    const fetchReferralData = async () => {
      if (!ready || !authenticated || !user?.id) return;

      try {
        setReferralLoading(true);
        const res = await fetch(`${API_BASE_URL}/users/${user.id}/referral`);
        if (res.ok) {
          const data = await res.json();
          setReferralData(data);
        }
      } catch (err) {
        console.error("Failed to fetch referral data:", err);
      } finally {
        setReferralLoading(false);
      }
    };

    fetchReferralData();
  }, [ready, authenticated, user?.id]);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <a href="/" className="flex items-center space-x-2">
            <img src="/corre_logo.png" alt="Corre" className="w-8 h-8" />
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold">Corre</span>
              <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/40">
                Beta
              </span>
            </div>
          </a>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
            {ready && authenticated ? (
              <>
                <Link to="/home">
                  <Button variant="ghost">Dashboard</Button>
                </Link>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" className="text-primary hover:text-primary hover:bg-primary/10">
                      Invite Frens
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                        <Users className="w-6 h-6 text-primary" />
                        Invite Frens
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 pt-4">
                      <p className="text-muted-foreground">
                        Invite your frens to Corre and grow the ecosystem together.
                        {referralData && (
                          <span className="block mt-2 font-medium text-foreground">
                            You've already invited {referralData.referralsCount} {referralData.referralsCount === 1 ? 'fren' : 'frens'}!
                          </span>
                        )}
                      </p>

                      {referralLoading ? (
                        <div className="animate-pulse h-12 bg-secondary/30 rounded-lg"></div>
                      ) : referralData ? (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 font-mono text-lg border border-border/40">
                            <span className="truncate">{referralData.referralCode}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const link = `${window.location.origin}/?ref=${referralData.referralCode}`;
                                navigator.clipboard.writeText(link);
                              }}
                              className="p-2 rounded-lg hover:bg-primary/20 text-primary transition-colors"
                              title="Copy referral link"
                            >
                              <Copy className="w-5 h-5" />
                            </button>
                          </div>
                          <Button
                            className="w-full rounded-full py-6 text-lg font-bold"
                            onClick={() => {
                              const link = `${window.location.origin}/?ref=${referralData.referralCode}`;
                              navigator.clipboard.writeText(link);
                            }}
                          >
                            Copy Referral Link
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-center text-muted-foreground italic">
                          Generating your unique code...
                        </p>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>

                <Button onClick={logout} variant="secondary">Logout</Button>
              </>
            ) : (
              <Button
                onClick={login}
                variant="default"
                className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
              >
                Login
              </Button>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-secondary transition-colors"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isOpen && (
        <div className="md:hidden border-t border-border/50 bg-background/95 backdrop-blur-xl">
          <div className="px-4 py-6 space-y-4">
            {ready && authenticated ? (
              <div className="flex flex-col space-y-2">
                <Link to="/home" onClick={() => setIsOpen(false)}>
                  <Button variant="ghost" className="w-full">Dashboard</Button>
                </Link>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" className="w-full text-primary hover:text-primary hover:bg-primary/10">
                      Invite Frens
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md mx-4">
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                        <Users className="w-6 h-6 text-primary" />
                        Invite Frens
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 pt-4">
                      <p className="text-muted-foreground">
                        Invite your frens to Corre and grow the ecosystem together.
                      </p>

                      {referralLoading ? (
                        <div className="animate-pulse h-12 bg-secondary/30 rounded-lg"></div>
                      ) : referralData ? (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 font-mono text-lg border border-border/40">
                            <span className="truncate">{referralData.referralCode}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const link = `${window.location.origin}/?ref=${referralData.referralCode}`;
                                navigator.clipboard.writeText(link);
                              }}
                              className="p-2 rounded-lg hover:bg-primary/20 text-primary transition-colors"
                            >
                              <Copy className="w-5 h-5" />
                            </button>
                          </div>
                          <Button
                            className="w-full rounded-full py-6 text-lg font-bold"
                            onClick={() => {
                              const link = `${window.location.origin}/?ref=${referralData.referralCode}`;
                              navigator.clipboard.writeText(link);
                            }}
                          >
                            Copy Referral Link
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-center text-muted-foreground italic">
                          Generating code...
                        </p>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>

                <Button onClick={() => { logout(); setIsOpen(false); }} variant="secondary" className="w-full">Logout</Button>
              </div>
            ) : (
              <Button
                onClick={() => {
                  setIsOpen(false);
                  login();
                }}
                className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90"
              >
                Login
              </Button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navigation;

