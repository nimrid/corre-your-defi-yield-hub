import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { usePrivy, useSigners } from "@privy-io/react-auth";
import { Link } from "react-router-dom";
import { Copy, Users } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

import { apiFetch } from "@/services/apiClient";
import { WebMcpStatusBadge } from "@/webmcp";


const TELEGRAM_COMMUNITY_URL = "https://t.me/+_ExsYWddoeNmZTA0";

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { addSigners } = useSigners();
  const [referralData, setReferralData] = useState<{ referralCode: string; referralsCount: number } | null>(null);
  const [referralLoading, setReferralLoading] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);

  useEffect(() => {
    if (ready && !authenticated) {
      if (localStorage.getItem("autoLogin") === "true") {
        localStorage.removeItem("autoLogin");
        login();
      }
    }
  }, [ready, authenticated, login]);

  const solWallet = user?.linkedAccounts?.find(
    (a: any) =>
      (a.type === "wallet" || a.type === "solana") &&
      (a.chainType === "solana" || a.chain_type === "solana" || (a.address && !a.address.startsWith("0x"))) &&
      a.walletClientType === "privy"
  );
  const needsDelegation = solWallet && !(solWallet as any).delegated;

  useEffect(() => {
    const fetchReferralData = async () => {
      if (!ready || !authenticated || !user?.id) return;

      try {
        setReferralLoading(true);
        const res = await apiFetch(`/users/${user.id}/referral`);
        if (!res.ok) return;

        const contentType = res.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) {
          const text = await res.text().catch(() => "");
          throw new Error(
            `Expected JSON but received '${contentType || "unknown"}'. ` +
              `First 120 chars: ${text.slice(0, 120)}`,
          );
        }

        const data = await res.json();
        setReferralData(data);
      } catch (err) {
        console.error("Failed to fetch referral data:", err);
      } finally {
        setReferralLoading(false);
      }
    };

    fetchReferralData();
  }, [ready, authenticated, user?.id]);

  const handleAuthorize = async () => {
    if (authorizing) return;
    if (!solWallet) {
      toast.error("No Solana wallet found.");
      return;
    }
    if (typeof addSigners !== "function") {
      toast.error("Your Privy SDK does not support addSigners.");
      return;
    }

    setAuthorizing(true);
    try {
      console.log("Authorizing agent with signer ID:", import.meta.env.VITE_PRIVY_SIGNER_ID);
      await addSigners({
        address: (solWallet as any).address,
        signers: [{ signerId: import.meta.env.VITE_PRIVY_SIGNER_ID as string }],
      });
      toast.success("Agent Authorized", {
        description: "You can now send transactions in chat.",
      });
    } catch (err: any) {
      console.error("Failed to authorize agent:", err);
      toast.error("Authorization Failed", {
        description: err?.message || JSON.stringify(err),
      });
    } finally {
      setAuthorizing(false);
    }
  };

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
            <WebMcpStatusBadge />

            {ready && authenticated ? (
              <>
                {needsDelegation && (
                  <Button
                    onClick={handleAuthorize}
                    disabled={authorizing}
                    variant="destructive"
                    className={authorizing ? "" : "animate-pulse"}
                  >
                    {authorizing ? "Authorizing..." : "Authorize Agent"}
                  </Button>
                )}
                <Link to="/home">
                  <Button variant="ghost">Dashboard</Button>
                </Link>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => window.open(TELEGRAM_COMMUNITY_URL, "_blank", "noopener,noreferrer")}
                >
                  Join our community
                </Button>

                <Link to="/referrals">
                  <Button variant="ghost" className="text-primary hover:text-primary hover:bg-primary/10">
                    Invite Frens
                  </Button>
                </Link>

                <Button onClick={logout} variant="secondary">Logout</Button>
              </>
            ) : (
              <Button
                onClick={() => login()}
                variant="default"
                className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
              >
                Login
              </Button>
            )}
          </div>

          {/* Mobile menu button and WebMCP badge */}
          <div className="flex items-center gap-2 md:hidden">
            <WebMcpStatusBadge />
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-lg hover:bg-secondary transition-colors"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Navigation */}
      {isOpen && (
        <div className="md:hidden border-t border-border/50 bg-background/95 backdrop-blur-xl">
          <div className="px-4 py-6 space-y-4">
            {ready && authenticated ? (
              <div className="flex flex-col space-y-2">
                {needsDelegation && (
                  <Button
                    onClick={handleAuthorize}
                    disabled={authorizing}
                    variant="destructive"
                    className={authorizing ? "w-full" : "animate-pulse w-full"}
                  >
                    {authorizing ? "Authorizing..." : "Authorize Agent"}
                  </Button>
                )}
                <Link to="/home" onClick={() => setIsOpen(false)}>
                  <Button variant="ghost" className="w-full">Dashboard</Button>
                </Link>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setIsOpen(false);
                    window.open(TELEGRAM_COMMUNITY_URL, "_blank", "noopener,noreferrer");
                  }}
                >
                  Join our community
                </Button>

                <Link to="/referrals" onClick={() => setIsOpen(false)}>
                  <Button variant="ghost" className="w-full text-primary hover:text-primary hover:bg-primary/10">
                    Invite Frens
                  </Button>
                </Link>

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

