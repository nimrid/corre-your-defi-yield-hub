import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BanknoteIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

const SendBank = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-24 space-y-8">
        <button
          type="button"
          onClick={() => navigate("/send")}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to send</span>
        </button>

        <div className="glass-card p-6 sm:p-8 rounded-2xl space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Send to bank
            </h1>
            <p className="text-sm text-muted-foreground">
              Cash out your USDC to bank accounts across all supported countries. More added gradually.
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-xs sm:text-sm text-muted-foreground">
              Choose your preferred off-ramp method:
            </p>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-2">
              <Button
                type="button"
                size="lg"
                className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold"
                onClick={() => navigate("/send/bank/africa")}
              >
                <BanknoteIcon className="w-4 h-4" />
                Nigeria bank off-ramp
              </Button>

              <Button
                type="button"
                size="lg"
                variant="outline"
                disabled
                className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold opacity-70"
              >
                <BanknoteIcon className="w-4 h-4" />
                Global bank off-ramp (coming soon)
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SendBank;
