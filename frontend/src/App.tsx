import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Home from "./pages/Home";
import Send from "./pages/Send";
import SendWallet from "./pages/SendWallet";
import SendBank from "./pages/SendBank";
import Save from "./pages/Save";
import SaveRegular from "./pages/SaveRegular";
import SaveProtected from "./pages/SaveProtected";
import Invest from "./pages/Invest";
import InvestUSStocks from "./pages/InvestUSStocks";
import InvestStockDetails from "./pages/InvestStockDetails";
import SendBankAfrica from "./pages/SendBankAfrica";
import { usePrivy } from "@privy-io/react-auth";
import { ShieldCheck, WifiOff, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

const queryClient = new QueryClient();

const App = () => {
  const { ready } = usePrivy();

  // Hooks must be at the top, not inside conditionals
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Capture referral code from URL
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) {
      localStorage.setItem("referredByCode", ref);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background via-background to-muted text-foreground px-4">
        <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card/80 shadow-sm px-6 py-8 space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-1">
            {isOnline ? (
              <ShieldCheck className="h-6 w-6" />
            ) : (
              <WifiOff className="h-6 w-6" />
            )}
          </div>

          <div className="space-y-1">
            <h1 className="text-lg font-semibold tracking-tight">
              {isOnline ? "Securing your session" : "You're offline"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isOnline
                ? "We're connecting to your Privy wallet and syncing balances. This usually takes just a moment."
                : "We couldn't reach our authentication service. Your funds remain safe on-chain – check your connection and try again."}
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 pt-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="relative inline-flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/40 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
              </span>
              <span>
                {isOnline
                  ? "Auto-retrying connection"
                  : "Waiting for internet connection"}
              </span>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="inline-flex items-center gap-1.5"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="h-3 w-3" />
              Refresh app
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/home" element={<Home />} />
            <Route path="/send" element={<Send />} />
            <Route path="/send/wallet" element={<SendWallet />} />
            <Route path="/send/bank" element={<SendBank />} />
            <Route path="/save" element={<Save />} />
            <Route path="/save/regular" element={<SaveRegular />} />
            <Route path="/save/protected" element={<SaveProtected />} />
            <Route path="/invest" element={<Invest />} />
            <Route path="/invest/us-stocks" element={<InvestUSStocks />} />
            <Route path="/invest/us-stocks/:mint" element={<InvestStockDetails />} />
            <Route path="/send/bank/africa" element={<SendBankAfrica />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;