import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { ArrowLeft, ShieldCheck, Layers, AlertTriangle, FileText, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Terms = () => {
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
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">CORRE PROTOCOL: TERMS OF SERVICE & LEGAL FRAMEWORK</h1>
            <p className="text-sm text-muted-foreground mt-1">Last Updated: July 18, 2026 | Version: 1.0</p>
          </div>

          <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
            {/* PART 1 */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-foreground font-semibold text-lg">
                <FileText className="w-5 h-5 text-primary" />
                <h2>PART 1: ACCEPTANCE & NATURE OF THE PLATFORM</h2>
              </div>
              <p>
                By accessing or using the web application located at <a href="https://corre.bond" className="text-primary hover:underline">https://corre.bond</a> (the "Interface") or interacting with smart contracts deployed by or integrated into Corre (the "Protocol"), you agree to be bound by these Terms of Service. If you do not agree to these terms, you must immediately cease accessing or using the Interface and Protocol.
              </p>
              <h3 className="font-semibold text-foreground text-base mt-4">1. What Corre Is</h3>
              <p>
                Corre is a non-custodial financial gateway and yield hub built to connect users with decentralized finance (DeFi) yield protocols, global tokenized equities, and cross-border payment rails. Our services include:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong className="text-foreground">DeFi Yield Hub (Save):</strong> Standard and Shielded USDC Savings Vaults that route deposits to automated yield protocols (such as Lulo and LI.FI).</li>
                <li><strong className="text-foreground">Global Investing (Invest):</strong> Access to fractional tokenized US stocks (e.g., AAPL, MSFT, TSLA) and private market assets traded via Solana liquidity aggregators (such as Jupiter).</li>
                <li><strong className="text-foreground">Cross-Border Transfers & Ramp (Send/Buy):</strong> Direct crypto-to-bank account transfers (including African banking corridors such as NGN) and fiat-to-USDC onboarding supported by payment partners.</li>
                <li><strong className="text-foreground">Gas Sponsorship & Hybrid Auth:</strong> Seamless onboarding via Privy embedded wallets with gas-sponsored transaction capabilities.</li>
              </ul>
            </section>

            {/* PART 2 */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-foreground font-semibold text-lg">
                <Lock className="w-5 h-5 text-primary" />
                <h2>PART 2: NON-CUSTODIAL WALLET & ACCOUNT RESPONSIBILITY</h2>
              </div>
              <p>
                Corre is strictly non-custodial. We do not take custody of your funds, manage seed phrases, or hold access keys to your blockchain wallets.
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong className="text-foreground">Authentication via Privy:</strong> Login services are facilitated by Privy, enabling non-custodial embedded wallet creation via email or social logins alongside traditional Web3 wallet connections.</li>
                <li><strong className="text-foreground">Sole Responsibility:</strong> You retain sole responsibility for securing your credentials, backup mechanisms, and connected devices. Loss of access to your authentication account or private keys results in permanent loss of access to your assets.</li>
                <li><strong className="text-foreground">No Asset Recovery:</strong> Corre developers and operators cannot recover lost funds, reverse signed transactions, or reset lost private key access.</li>
              </ul>
            </section>

            {/* PART 3 */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-foreground font-semibold text-lg">
                <Layers className="w-5 h-5 text-primary" />
                <h2>PART 3: ELIGIBILITY, FAIR USE & GAS SPONSORSHIP</h2>
              </div>
              <h3 className="font-semibold text-foreground text-base mt-2">1. User Eligibility</h3>
              <p>
                You represent and warrant that you are at least 18 years of age and are not located in, a resident of, or organized under the laws of Cuba, Iran, North Korea, Syria, Crimea, or any jurisdiction where accessing DeFi protocols or tokenized equities is restricted by law. You represent that you are not listed on international sanctions registries (such as the OFAC Specially Designated Nationals list).
              </p>
              <h3 className="font-semibold text-foreground text-base mt-2">2. Gas Sponsorship & Anti-Abuse Rules</h3>
              <p>
                To provide a seamless experience, Corre may sponsor network transaction fees (gas) for eligible account operations.
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Sponsorship is provided at Corre’s sole discretion as a convenience feature.</li>
                <li>We reserve the right to enforce rate limits, daily caps, or restrict gas sponsorship for accounts suspected of automated botting, sybil attacks, or platform abuse.</li>
              </ul>
              <h3 className="font-semibold text-foreground text-base mt-2">3. Prohibited Activities</h3>
              <p>You agree not to engage in:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Money laundering, terrorist financing, or sanctions evasion.</li>
                <li>Market manipulation, wash trading, or exploitation of protocol software bugs.</li>
                <li>Attacking or overburdening the Interface, backend APIs, or RPC nodes.</li>
              </ul>
            </section>

            {/* PART 4 */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-foreground font-semibold text-lg">
                <AlertTriangle className="w-5 h-5 text-primary" />
                <h2>PART 4: PROTOCOL & MARKET RISK DISCLOSURES</h2>
              </div>
              <p>By using Corre, you explicitly acknowledge and accept the inherent risks of decentralized finance:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong className="text-foreground">Smart Contract Vulnerabilities:</strong> Smart contract code powering vaults, DEX aggregators, or cross-chain bridges may contain un-detected software bugs or exploits.</li>
                <li><strong className="text-foreground">Market Volatility & Slippage:</strong> Prices of cryptocurrencies, stablecoins, and tokenized US stocks fluctuate. Trade execution through decentralized liquidity pools is subject to market slippage.</li>
                <li><strong className="text-foreground">Third-Party Protocol Dependencies:</strong> Yield rates are generated by independent third-party protocols (Lulo, LI.FI, Jupiter). Corre does not guarantee yields or insure against third-party insolvency.</li>
                <li><strong className="text-foreground">No Deposit Insurance:</strong> Funds held on-chain or deposited into Corre vaults are not insured by the FDIC, SIPC, or any sovereign financial guarantee fund.</li>
              </ul>
            </section>

            {/* PART 5 */}
            <section className="space-y-3 border-t border-border/50 pt-6">
              <div className="flex items-center gap-2 text-foreground font-semibold text-lg">
                <ShieldCheck className="w-5 h-5 text-primary" />
                <h2>PART 5: INTELLECTUAL PROPERTY & OPEN SOURCE</h2>
              </div>
              <p>
                The Corre Interface design, branding, domain, logos, and custom UI components are owned by Corre Protocol. Underlying open-source smart contract code components are distributed under the MIT License:
              </p>
              <div className="p-4 rounded-xl bg-secondary/50 font-mono text-xs text-muted-foreground uppercase space-y-2">
                <p>THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.</p>
                <p>IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY ARISING FROM THE USE OF THE SOFTWARE OR INTERFACE.</p>
              </div>
            </section>

            {/* PART 6 */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">PART 6: MODIFICATIONS & CONTACT</h2>
              <p>
                Corre reserves the right to modify or update these Terms of Service at any time. Continued use of the Interface after updates constitutes acceptance of the modified terms.
              </p>
              <p>For questions or support regarding these terms, please contact:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Email: <a href="mailto:eddy@corre.bond" className="text-primary hover:underline">eddy@corre.bond</a></li>
                <li>Telegram: <a href="https://t.me/+_ExsYWddoeNmZTA0" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Corre Community</a></li>
              </ul>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Terms;
