import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { ArrowLeft, ShieldCheck, Landmark, Globe, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

const About = () => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1 && document.referrer.includes(window.location.host)) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navigation />
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 space-y-8 w-full">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </button>

        <div className="glass-card p-6 sm:p-8 rounded-2xl space-y-8">
          <div className="space-y-4 border-b border-border/50 pb-6">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">About Corre</h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Bridging the gap between decentralized finance and traditional banking, giving you borderless access to global wealth opportunities.
            </p>
          </div>
          
          <div className="space-y-8 text-sm sm:text-base leading-relaxed text-muted-foreground">
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-foreground font-semibold text-xl">
                <Globe className="w-5 h-5 text-primary" />
                <h2>Who We Are</h2>
              </div>
              <p>
                Corre is a comprehensive financial hub designed for the modern user. We believe that wealth generation should not be limited by geography or complex technical barriers. By combining the power of blockchain technology with intuitive interfaces, we are building a robust platform that makes global financial instruments accessible to everyone.
              </p>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2 text-foreground font-semibold text-xl">
                <Landmark className="w-5 h-5 text-primary" />
                <h2>What We Do</h2>
              </div>
              <p>
                We provide a unified gateway to multiple financial services:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong className="text-foreground">DeFi Savings (Yield Hub):</strong> Our shielded and standard vaults allow you to earn yield on your USDC assets securely via protocols like Lulo and LI.FI.</li>
                <li><strong className="text-foreground">Global Investments:</strong> Access fractional investments in tokenized US Stocks (AAPL, MSFT, TSLA) directly from your wallet via Jupiter DEX aggregator routing.</li>
                <li><strong className="text-foreground">Cross-Border Transfers:</strong> Seamlessly send funds to traditional bank accounts, particularly across Africa, converting crypto to fiat instantly.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2 text-foreground font-semibold text-xl">
                <Zap className="w-5 h-5 text-primary" />
                <h2>How We Help You</h2>
              </div>
              <p>
                Navigating decentralized finance can be daunting. We eliminate those hurdles to give you a seamless experience:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong className="text-foreground">Gas Sponsorships:</strong> We handle complex network fees, ensuring that your transactions are smooth and cost-effective.</li>
                <li><strong className="text-foreground">Intuitive Design:</strong> No need to understand complex blockchain infrastructure. We bring the familiar experience of traditional finance to the DeFi ecosystem.</li>
                <li><strong className="text-foreground">Security & Non-Custodial Control:</strong> With Privy hybrid auth and direct on-chain actions, you maintain total control of your funds at all times.</li>
              </ul>
            </section>

            <section className="space-y-3 border-t border-border/50 pt-6">
              <div className="flex items-center gap-2 text-foreground font-semibold text-xl">
                <ShieldCheck className="w-5 h-5 text-primary" />
                <h2>Our Mission</h2>
              </div>
              <p>
                Our mission is to democratize finance. Whether you want to preserve your wealth in stable yields, invest in top-tier global stocks, or remit money to loved ones, Corre equips you with the necessary tools to achieve financial freedom confidently.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default About;
