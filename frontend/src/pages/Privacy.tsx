import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { ArrowLeft, Shield, Eye, Server, Lock, Database } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Privacy = () => {
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
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">CORRE PROTOCOL: PRIVACY POLICY</h1>
            <p className="text-sm text-muted-foreground mt-1">Last Updated: July 18, 2026 | Version: 1.0</p>
          </div>

          <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
            {/* SECTION 1 */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-foreground font-semibold text-lg">
                <Shield className="w-5 h-5 text-primary" />
                <h2>1. OVERVIEW & PRIVACY COMMITMENT</h2>
              </div>
              <p>
                This Privacy Policy outlines how Corre Protocol ("we", "us", or "our") collects, uses, and safeguards information when you visit or use our web app (<a href="https://corre.bond" className="text-primary hover:underline">corre.bond</a>) and associated interfaces.
              </p>
              <p>
                Corre is designed with a privacy-first mindset. As a decentralized finance (DeFi) yield hub and cross-border platform, we minimize off-chain personal data collection while ensuring a seamless, gas-optimized user experience.
              </p>
            </section>

            {/* SECTION 2 */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-foreground font-semibold text-lg">
                <Eye className="w-5 h-5 text-primary" />
                <h2>2. INFORMATION WE COLLECT</h2>
              </div>
              
              <h3 className="font-semibold text-foreground text-base mt-3">A. Account & Authentication Data (Privy)</h3>
              <p>
                When you sign in to Corre, we utilize <strong>Privy</strong> for embedded wallet generation and authentication. Depending on your chosen login method, Privy processes:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Your email address or social login identifier (e.g. Google/Twitter login).</li>
                <li>Your generated non-custodial Solana public wallet address.</li>
              </ul>

              <h3 className="font-semibold text-foreground text-base mt-3">B. Blockchain Data (On-Chain Records)</h3>
              <p>
                When interacting with Corre vaults, Jupiter stock routing, or transfers, your public wallet address and transaction payloads are written to the Solana blockchain.
              </p>
              <p className="font-medium text-foreground bg-secondary/40 p-3 rounded-lg border border-border/40">
                Important Note: Public blockchain data (wallet transactions, vault deposits, token swaps) is permanently visible, immutable, and public by nature. Corre cannot alter or delete data recorded on the blockchain.
              </p>

              <h3 className="font-semibold text-foreground text-base mt-3">C. Cross-Border Fiat & Bank Payout Data</h3>
              <p>
                When using our cross-border payment features (e.g., sending crypto directly to bank accounts in Africa such as Naira NGN payouts):
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>We collect recipient bank details (bank name, account number, account holder name) strictly necessary to process the payout through regulated fiat payment partners.</li>
                <li>This data is encrypted and passed securely to licensed payout providers to fulfill bank settlement.</li>
              </ul>

              <h3 className="font-semibold text-foreground text-base mt-3">D. Technical & Network Logs</h3>
              <p>
                Like most web applications, standard server logs are collected by our infrastructure and RPC providers (Netlify, Alchemy, Helius) for security, rate-limiting, and DDoS protection:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>IP address and user-agent string.</li>
                <li>Browser type, operating system, and timestamp.</li>
              </ul>
            </section>

            {/* SECTION 3 */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-foreground font-semibold text-lg">
                <Database className="w-5 h-5 text-primary" />
                <h2>3. HOW WE USE YOUR INFORMATION</h2>
              </div>
              <p>We process collected data exclusively for operational and compliance purposes:</p>
              <ol className="list-decimal pl-5 space-y-2">
                <li><strong className="text-foreground">Service Delivery:</strong> Enabling wallet authentication, yield vault interaction, stock trading, and fiat payout settlement.</li>
                <li><strong className="text-foreground">Gas Sponsorship Security:</strong> Validating account eligibility and enforcing anti-abuse rate limits for free gas transactions.</li>
                <li><strong className="text-foreground">Compliance & Screening:</strong> Screening public wallet addresses against global sanctions registries (e.g., OFAC) to comply with international regulations.</li>
                <li><strong className="text-foreground">User Support:</strong> Responding to inquiries submitted through our official support channels.</li>
              </ol>
            </section>

            {/* SECTION 4 */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-foreground font-semibold text-lg">
                <Server className="w-5 h-5 text-primary" />
                <h2>4. COOKIES, LOCAL STORAGE & THIRD-PARTY SERVICES</h2>
              </div>
              <p>
                Corre uses local browser storage (localStorage) solely to maintain active wallet session state so you don't need to re-authenticate on every page refresh.
              </p>
              <p>We do NOT use invasive cross-site tracking cookies or selling user data to advertising networks.</p>

              <h3 className="font-semibold text-foreground text-base mt-3">Third-Party Service Providers</h3>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong className="text-foreground">Privy:</strong> Embedded wallet authentication and security provider.</li>
                <li><strong className="text-foreground">Solana RPC Nodes (Alchemy, Helius):</strong> Blockchain read/write request processors.</li>
                <li><strong className="text-foreground">Fiat Off-Ramp Partners:</strong> Licensed fiat gateways for bank payout processing.</li>
                <li><strong className="text-foreground">Netlify:</strong> Application web hosting and edge routing.</li>
              </ul>
            </section>

            {/* SECTION 5 */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-foreground font-semibold text-lg">
                <Lock className="w-5 h-5 text-primary" />
                <h2>5. DATA SECURITY & RETENTION</h2>
              </div>
              <p>
                All web traffic is transmitted via modern TLS/SSL encryption. Off-chain logs and bank payout details are retained only for the duration required for transaction verification, security auditing, and legal compliance.
              </p>
              <p>
                We never store, request, or have access to your private key or seed phrase.
              </p>
            </section>

            {/* SECTION 6 */}
            <section className="space-y-3 border-t border-border/50 pt-6">
              <h2 className="text-lg font-semibold text-foreground">6. CONTACT & PRIVACY INQUIRIES</h2>
              <p>If you have questions or concerns regarding this Privacy Policy, please contact our team:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Email: <a href="mailto:eddy@corre.bond" className="text-primary hover:underline">eddy@corre.bond</a></li>
                <li>Telegram: <a href="https://t.me/+_ExsYWddoeNmZTA0" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Corre Official Telegram</a></li>
              </ul>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Privacy;
