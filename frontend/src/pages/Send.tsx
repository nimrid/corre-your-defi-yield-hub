import Navigation from "@/components/Navigation";
import { ArrowLeft } from "lucide-react";
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

        <div className="grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => navigate("/send/wallet")}
            className="glass-card p-6 text-left rounded-2xl hover:shadow-lg transition-shadow"
          >
            <h2 className="text-xl font-semibold mb-2">Send to wallet</h2>
            <p className="text-sm text-muted-foreground">
              Transfer USDC to another crypto wallet address.
            </p>
          </button>
          <button className="glass-card p-6 text-left rounded-2xl hover:shadow-lg transition-shadow" type="button">
            <h2 className="text-xl font-semibold mb-2">Send to bank</h2>
            <p className="text-sm text-muted-foreground">
              Cash out to a linked bank account.
            </p>
          </button>
        </div>
      </main>
    </div>
  );
};

export default Send;
