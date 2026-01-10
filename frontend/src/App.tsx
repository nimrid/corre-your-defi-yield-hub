import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Home from "./pages/Home";
import Send from "./pages/Send";
import SendWallet from "./pages/SendWallet";
import Save from "./pages/Save";
import SaveRegular from "./pages/SaveRegular";
import SaveProtected from "./pages/SaveProtected";
import Invest from "./pages/Invest";
import InvestUSStocks from "./pages/InvestUSStocks";
import InvestStockDetails from "./pages/InvestStockDetails";
import { usePrivy } from "@privy-io/react-auth";

const queryClient = new QueryClient();

const App = () => {
  const { ready } = usePrivy();
  if (!ready) {
    return <div style={{ padding: 24 }}>Loading...</div>;
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
            <Route path="/save" element={<Save />} />
            <Route path="/save/regular" element={<SaveRegular />} />
            <Route path="/save/protected" element={<SaveProtected />} />
            <Route path="/invest" element={<Invest />} />
            <Route path="/invest/us-stocks" element={<InvestUSStocks />} />
            <Route path="/invest/us-stocks/:mint" element={<InvestStockDetails />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
