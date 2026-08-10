import Navigation from "@/components/Navigation";
import { ArrowLeft, ArrowRight, Wallet, Landmark } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Send = () => {
  const navigate = useNavigate();

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

        <div className="space-y-4">
          <h1 className="text-3xl font-bold tracking-tight mb-4">Send</h1>
          <p className="text-muted-foreground mb-6">
            Choose how you want to send funds.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => navigate("/send/wallet")}
            className="glass-card p-6 text-left rounded-2xl hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer flex flex-col justify-between border border-border/60 hover:border-primary/50 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
              <Wallet className="w-24 h-24 text-primary" />
            </div>
            <div className="space-y-4 relative z-10">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                <Wallet className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold mb-1 group-hover:text-primary transition-colors">Send to wallet</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Transfer SOL or USDC to another crypto wallet address.
                </p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-border/40 flex items-center justify-between text-xs font-semibold text-primary group-hover:translate-x-1 transition-transform relative z-10">
              <span>Send Crypto</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate("/send/bank")}
            className="glass-card p-6 text-left rounded-2xl hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer flex flex-col justify-between border border-border/60 hover:border-primary/50 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
              <Landmark className="w-24 h-24 text-primary" />
            </div>
            <div className="space-y-4 relative z-10">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                <Landmark className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold mb-1 group-hover:text-primary transition-colors">Send to bank</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Cash out to a linked bank account.
                </p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-border/40 flex items-center justify-between text-xs font-semibold text-primary group-hover:translate-x-1 transition-transform relative z-10">
              <span>Cash Out</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      </main>
    </div>
  );
};

export default Send;
