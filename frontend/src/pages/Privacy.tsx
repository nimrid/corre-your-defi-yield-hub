import Navigation from "@/components/Navigation";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Privacy = () => {
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
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">CORRE PROTOCOL: PRIVACY POLICY</h1>
          <p className="text-sm text-muted-foreground">Last Updated: January 16, 2026 | Version: 1.0</p>
          
          <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">1. INTRODUCTION</h2>
              <p>This Privacy Policy describes how Corre Protocol ("we", "us", or "our") collects, uses, and discloses information when you visit or use our web app located at (corre.bond) and the interface to our smart contracts (the "Interface").</p>
              <p>We value your privacy and are committed to protecting your personal data. This policy explains what data we collect, particularly in the context of Decentralized Finance (DeFi) and blockchain technology.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">2. INFORMATION WE COLLECT</h2>
              
              <h3 className="font-medium text-foreground mt-4">A. Information You Provide</h3>
              <p>We do not create user accounts. We do not ask for your name, email address, phone number, or password to use the Interface.</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Support Inquiries: If you contact us directly via email or social media for support, we may collect your email address or handle to respond to your inquiry.</li>
              </ul>

              <h3 className="font-medium text-foreground mt-4">B. Information Automatically Collected (Web Data)</h3>
              <p>When you visit the Site, we and our service providers (such as Netlify) may automatically log standard technical information, including:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Device Information: Your web browser type, operating system, and device type.</li>
                <li>Network Information: Your IP address, referring domains, and page exit data.</li>
                <li>Usage Data: Clickstream data, time spent on pages, and interaction with UI elements.</li>
              </ul>

              <h3 className="font-medium text-foreground mt-4">C. Blockchain Information (Wallet Data)</h3>
              <p>When you "Connect Wallet" to our Interface, we collect:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Public Wallet Address: We read your public Ethereum (or compatible chain) address to display your balances and allow you to sign transactions.</li>
                <li>Transaction History: We may read your transaction history associated with the Corre smart contracts to display your past activity on the Interface.</li>
              </ul>
              <p className="font-medium">Important Note: Your public wallet address and all transactions you approve are written to the public blockchain. This data is immutable, public, and outside of our control. We cannot "delete" data from the blockchain.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">3. HOW WE USE YOUR INFORMATION</h2>
              <p>We use the collected information for the following purposes:</p>
              <ol className="list-decimal pl-5 space-y-2">
                <li>To Provide the Service: Enabling your wallet to interact with our smart contracts.</li>
                <li>To Improve the Interface: Analyzing usage trends (e.g., which pools are most popular) to optimize the user experience.</li>
                <li>Security & Debugging: detecting bugs, errors, or malicious activity (e.g., DDoS attacks) on the Site.</li>
                <li>Compliance: We may use wallet addresses to screen against international sanctions lists (e.g., OFAC) to ensure compliance with applicable laws.</li>
              </ol>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">4. COOKIES AND LOCAL STORAGE</h2>
              <p>We use local storage and cookies to improve functionality.</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Session Data: We use local storage to "remember" that you have connected your wallet so you do not have to re-connect on every page refresh.</li>
                <li>Analytics: We may use privacy-preserving analytics tools to measure site traffic. These tools do not link your IP address to your wallet address.</li>
              </ul>
              <p>You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, if you do not accept cookies, some portions of the Interface may not function properly.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">5. THIRD-PARTY SERVICES</h2>
              <p>We use third-party services to operate the Interface. These providers may have their own privacy policies:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Hosting: Our site is hosted on Netlify. Netlify collects access logs including IP addresses for security and performance.</li>
                <li>RPC Providers: To read data from the blockchain, the Interface may connect to Remote Procedure Call (RPC) nodes (e.g., Infura, Alchemy). These providers may log your IP address and wallet address when you make a transaction request.</li>
                <li>Wallet Providers: Your interaction with the blockchain is mediated by your wallet provider (e.g., MetaMask, WalletConnect). We do not control their data practices.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">6. DATA SECURITY</h2>
              <p>We use standard SSL/TLS encryption for the Site. However, please be aware that:</p>
              <ol className="list-decimal pl-5 space-y-2">
                <li>No method of transmission over the Internet is 100% secure.</li>
                <li>We never have access to your private keys or seed phrase. You are solely responsible for the security of your wallet credentials.</li>
              </ol>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">7. DATA RETENTION & DELETION</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>Off-Chain Data: We retain server logs for a limited period necessary for security and debugging.</li>
                <li>On-Chain Data: We cannot delete or modify data written to the blockchain. Your transaction history is permanent.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">8. CHILDREN'S PRIVACY</h2>
              <p>Our Service is not directed to anyone under the age of 18. We do not knowingly collect personal information from anyone under the age of 18. If you are a parent or guardian and you are aware that your child has provided us with Personal Data, please contact us.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">9. CHANGES TO THIS POLICY</h2>
              <p>We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date. You are advised to review this Privacy Policy periodically for any changes.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">10. CONTACT US</h2>
              <p>If you have any questions about this Privacy Policy, please contact us:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>By Email: edidionguwemedimo@gmail.com</li>
                <li>By Telegram: <a href="https://t.me/+_ExsYWddoeNmZTA0" className="text-primary hover:underline">https://t.me/+_ExsYWddoeNmZTA0</a></li>
              </ul>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Privacy;
