import Navigation from "@/components/Navigation";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Terms = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 space-y-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <div className="glass-card p-6 sm:p-8 rounded-2xl space-y-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">CORRE PROTOCOL: LEGAL FRAMEWORK & USER AGREEMENT</h1>
          <p className="text-sm text-muted-foreground">Last Updated: January 16, 2026 | Version: 1.0</p>
          
          <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">PART 1: MIT LICENSE (OPEN SOURCE CODE)</h2>
              <p>Copyright (c) 2026 Corre Protocol</p>
              <p>Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:</p>
              <p>The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.</p>
              <p className="uppercase">THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">PART 2: TERMS OF SERVICE</h2>
              
              <h3 className="font-medium text-foreground mt-4">1. Acceptance of Terms</h3>
              <p>By accessing or using the interface at https://corre.bond/ (the "Interface") or the Corre smart contracts (the "Protocol"), you agree to be bound by these Terms of Service. If you do not agree to these terms, you must not access or use the Interface or the Protocol.</p>
              
              <h3 className="font-medium text-foreground mt-4">2. Nature of the Interface</h3>
              <p>The Interface is a web-based user interface that provides access to the Corre Protocol, a decentralized autonomous smart contract system deployed on the [Ethereum / Polygon / Arbitrum] blockchain.</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Non-Custodial: Corre is a non-custodial protocol. You retain full control of your private keys and assets at all times. We do not have access to your funds, nor can we recover your funds if you lose your private keys.</li>
                <li>No Intermediary: The Interface is distinct from the Protocol. The Interface is merely a visual tool to interact with the blockchain.</li>
              </ul>

              <h3 className="font-medium text-foreground mt-4">3. Eligibility</h3>
              <p>You represent and warrant that you are not:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Located in, organized in, or a resident of Cuba, Iran, North Korea, Syria, the Crimea region, or any other jurisdiction where DeFi applications are prohibited by law.</li>
                <li>Listed on any sanctions list (e.g., OFAC SDN List, UN Sanctions List).</li>
              </ul>

              <h3 className="font-medium text-foreground mt-4">4. Prohibited Activity</h3>
              <p>You agree not to use the Interface or Protocol for:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Money laundering, terrorist financing, or other illicit financial activities.</li>
                <li>Market manipulation (e.g., pump and dump schemes, wash trading).</li>
                <li>Exploiting bugs or vulnerabilities to steal funds from other users.</li>
              </ul>

              <h3 className="font-medium text-foreground mt-4">5. Intellectual Property</h3>
              <p>The Interface design, text, graphics, and logos are owned by Corre. The underlying smart contract code is open-source under the MIT License (see Part 1).</p>

              <h3 className="font-medium text-foreground mt-4">6. Limitation of Liability</h3>
              <p className="uppercase">TO THE FULLEST EXTENT PERMITTED BY LAW, IN NO EVENT WILL CORRE, ITS DEVELOPERS, OR AFFILIATES BE LIABLE FOR ANY INDIRECT, SPECIAL, INCIDENTAL, CONSEQUENTIAL, OR EXEMPLARY DAMAGES OF ANY KIND (INCLUDING, BUT NOT LIMITED TO, LOSS OF REVENUE, INCOME, OR PROFITS) ARISING OUT OF OR RELATED TO THE USE OF THE INTERFACE OR PROTOCOL.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">PART 3: RISK DISCLOSURES (IMPORTANT)</h2>
              <p className="font-medium text-foreground">BY USING CORRE, YOU ACKNOWLEDGE THAT YOU UNDERSTAND THE FOLLOWING RISKS:</p>
              
              <h3 className="font-medium text-foreground mt-4">1. Smart Contract Risk</h3>
              <p>The Protocol is built on smart contract technology. While we strive for security, code may contain bugs, vulnerabilities, or errors that could lead to the complete loss of funds. You accept these risks by depositing funds.</p>

              <h3 className="font-medium text-foreground mt-4">2. Impermanent Loss</h3>
              <p>If you participate in liquidity provision, you acknowledge the risk of "impermanent loss," where the value of your deposited assets may be less than if you had simply held the assets in a wallet, due to market volatility.</p>

              <h3 className="font-medium text-foreground mt-4">3. Regulatory Uncertainty</h3>
              <p>Blockchain technology and DeFi are subject to evolving regulations. New laws or regulations could adversely affect the Protocol or your ability to access the Interface.</p>

              <h3 className="font-medium text-foreground mt-4">4. Flash Loan Attacks</h3>
              <p>DeFi protocols are susceptible to economic attacks, such as flash loan exploits, which can drain liquidity pools.</p>

              <h3 className="font-medium text-foreground mt-4">5. No Deposit Insurance</h3>
              <p>Funds held in the Protocol are not insured by the FDIC, SIPC, or any other government agency. You are solely responsible for the security of your funds.</p>

              <h3 className="font-medium text-foreground mt-4">6. Wallet Security</h3>
              <p>You are responsible for safeguarding your private keys and seed phrases. If you lose access to your wallet, Corre cannot recover your funds.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">PART 4: PRIVACY POLICY</h2>
              
              <h3 className="font-medium text-foreground mt-4">1. Data Collection</h3>
              <p>Corre prioritizes user privacy.</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>We do not collect personal data such as names, addresses, email addresses, or phone numbers.</li>
                <li>We do not use cookies for tracking personal behavior across the web.</li>
              </ul>

              <h3 className="font-medium text-foreground mt-4">2. Public Blockchain Data</h3>
              <p>When you use the Interface, your public wallet address and transaction data are written to the blockchain. This data is public, immutable, and accessible by anyone. We have no control over this public data.</p>

              <h3 className="font-medium text-foreground mt-4">3. Third-Party Services</h3>
              <p>The Interface is hosted on Netlify. Netlify may collect standard server logs (IP addresses) for security and performance monitoring. Please refer to Netlify’s privacy policy for details.</p>

              <h3 className="font-medium text-foreground mt-4">4. Analytics</h3>
              <p>We may use anonymized, privacy-focused analytics to track Interface usage (e.g., number of visitors). This data is not linked to your wallet address or personal identity.</p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Terms;
