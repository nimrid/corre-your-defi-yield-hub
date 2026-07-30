import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { ArrowLeft, AlertTriangle, ShieldAlert, TrendingDown, Scale, Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Disclaimer = () => {
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

        <div className="glass-card p-6 sm:p-8 rounded-2xl space-y-6">
          <div className="border-b border-border/50 pb-6">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">CORRE PROTOCOL: GENERAL DISCLAIMER</h1>
            <p className="text-sm text-muted-foreground mt-1">Last Updated: July 18, 2026 | Version 1.0</p>
          </div>

          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm flex gap-3 items-start">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <p>
              Please read this disclaimer carefully before using the Corre interface, yield vaults, tokenized stock trading, or cross-border payment tools. By using our platform, you acknowledge and agree to the risks described below.
            </p>
          </div>

          <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-foreground font-semibold text-lg">
                <Scale className="w-5 h-5 text-primary" />
                <h2>1. NO FINANCIAL OR INVESTMENT ADVICE</h2>
              </div>
              <p>
                The information provided on the Corre platform, web interface, and associated documentation does not constitute investment advice, financial advice, trading advice, or any other sort of recommendation.
              </p>
              <p>
                Corre does not recommend that any cryptocurrency, tokenized asset, vault strategy, or yield product should be bought, sold, or held by you. You are solely responsible for conducting your own due diligence and consulting with qualified financial, tax, and legal advisors before making any investment decisions.
              </p>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2 text-foreground font-semibold text-lg">
                <ShieldAlert className="w-5 h-5 text-primary" />
                <h2>2. NON-CUSTODIAL PLATFORM & USER CONTROL</h2>
              </div>
              <p>
                Corre provides a decentralized interface to non-custodial smart contracts deployed on the Solana blockchain.
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong className="text-foreground">Full Control:</strong> You retain complete ownership and exclusive control over your private keys, embedded wallets (via Privy), and digital assets.</li>
                <li><strong className="text-foreground">No Asset Custody:</strong> Corre never takes custody of user funds, stores seed phrases, or possesses the ability to reverse or pause your on-chain transactions.</li>
                <li><strong className="text-foreground">Loss of Credentials:</strong> If you lose access to your login credentials or wallet keys, Corre cannot recover your funds or reset access.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2 text-foreground font-semibold text-lg">
                <TrendingDown className="w-5 h-5 text-primary" />
                <h2>3. DEFI YIELD VAULT & PROTOCOL RISKS</h2>
              </div>
              <p>
                Yield-generating products on Corre (including Standard and Shielded Savings Vaults) route funds through third-party automated liquidity and lending protocols (such as Lulo and LI.FI).
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong className="text-foreground">Smart Contract Vulnerabilities:</strong> Smart contracts are subject to technical risks, including bugs, exploits, or unexpected code execution that could result in total loss of deposited capital.</li>
                <li><strong className="text-foreground">Yield Variable Rates:</strong> Yield rates, APYs, and projected returns displayed on the interface are dynamic and subject to market fluctuations. Returns are not guaranteed.</li>
                <li><strong className="text-foreground">Third-Party Protocol Risk:</strong> Corre is not liable for protocol failures, insolvency, or liquidity shortages in third-party yield integrations.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2 text-foreground font-semibold text-lg">
                <Building2 className="w-5 h-5 text-primary" />
                <h2>4. TOKENIZED STOCKS & GLOBAL INVESTMENTS</h2>
              </div>
              <p>
                Corre enables access to tokenized traditional assets and US equities (such as tokenized shares of AAPL, MSFT, TSLA) powered by Solana decentralized exchanges and liquidity routers (e.g., Jupiter).
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong className="text-foreground">Blockchain Synthetics:</strong> Tokenized stocks are digital tokens tracking underlying assets on-chain. They do not confer direct legal ownership, shareholder voting rights, or dividend guarantees unless explicitly structured by the issuing protocol.</li>
                <li><strong className="text-foreground">No FDIC or SIPC Insurance:</strong> Digital assets and tokenized stocks on Corre are NOT protected by the Federal Deposit Insurance Corporation (FDIC) or Securities Investor Protection Corporation (SIPC).</li>
                <li><strong className="text-foreground">Slippage & Market Volatility:</strong> Asset prices fluctuate rapidly. Trades are subject to market slippage, network latency, and DEX liquidity depth.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">5. CROSS-BORDER PAYMENTS & FIAT RAMP DISCLOSURES</h2>
              <p>
                Cross-border transfers to traditional bank accounts (e.g., African banking corridors including Naira NGN payouts) and fiat-to-crypto purchases are processed in coordination with licensed third-party payment infrastructure providers.
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong className="text-foreground">Bank Settlement Delays:</strong> While off-ramps are optimized for speed, bank processing times, local banking network downtime, or compliance checks may occasionally delay fiat credit to your destination account.</li>
                <li><strong className="text-foreground">Exchange Rate Fluctuations:</strong> Currency exchange rates (such as USD/NGN) are dynamically determined at the time of conversion.</li>
              </ul>
            </section>

            <section className="space-y-3 border-t border-border/50 pt-6">
              <h2 className="text-lg font-semibold text-foreground">6. CONTACT & INQUIRIES</h2>
              <p>
                If you have questions regarding this Disclaimer or need technical support, please reach out via:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Email: <a href="mailto:eddy@corre.bond" className="text-primary hover:underline">eddy@corre.bond</a></li>
                <li>Telegram Community: <a href="https://t.me/+_ExsYWddoeNmZTA0" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Corre Official Telegram</a></li>
              </ul>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Disclaimer;
