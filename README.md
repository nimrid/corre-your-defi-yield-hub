# Corre: The Ultimate DeFi Yield Hub 🚀

Corre is a premium DeFi ecosystem designed to simplify yield generation, cross-border payments, and real-world asset investing. Built for the modern user, it bridges the gap between traditional finance and decentralized protocols, with a special focus on accessibility and gas-optimized experiences.

![Corre Dashboard Preview](https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&q=80&w=2000)

## ✨ Core Features

### 💰 Yield Hub (Savings)
- **Standard Savings Vault**: High-performance yield generation for your USDC.
- **Shielded Savings Vault**: Protected yield opportunities with enhanced security parameters.
- **Automated Management**: Powered by institutional-grade protocols like Lulo and LI.FI.

### 📈 Global Investing
- **Tokenized US Stocks**: Buy fractional shares of top US companies (AAPL, MSFT, TSLA, etc.) directly on the Solana blockchain.
- **Jupiter Integration**: Seamless execution and best-price routing for all tokenized asset trades.
- **Real-time Analytics**: Built-in TradingView charts and market performance monitoring.

### 🌍 Seamless Payments & On-boarding
- **Fiat On/Off-Ramp**: Purchase USDC directly with bank accounts, with optimized support for **Naira (NGN)** and other African corridors.
- **Cross-Border Transfers**: Send USDC to any wallet or directly to bank accounts in supported regions.
- **Gas-Sponsored Transactions**: Enjoy a "gas-less" experience for supported transactions using Privy embedded wallets.

### 🛡️ Secure & Private
- **Hybrid Auth**: Secure login via **Privy**, supporting both email/social logins and existing Web3 wallets.
- **Private Beta**: Controlled ecosystem growth via a referral-based early access system.
- **Enterprise Security**: Comprehensive gas sponsorship protection and rate-limiting to prevent abuse.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React, Vite, TypeScript, Tailwind CSS, shadcn/ui, Lucide Icons |
| **State & Data** | TanStack Query (React Query), viem, ethers.js, @solana/web3.js |
| **Backend** | Node.js, Express, PostgreSQL, Inngest (Background Jobs) |
| **Authentication** | Privy (Email, Social, Embedded Wallets) |
| **Infrastructure** | Supabase, Resend (Email), Svix (Webhooks), Alchemy RPC |
| **Integrations** | LI.FI Earn, Jupiter (Solana), Lulo, Paj Ramp |

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- PostgreSQL Database
- Privy Application ID
- Jupiter API Key (for In-App Trading)
- Alchemy/Helius API Key (for Solana DAS/RPC)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd corre-your-defi-yield-hub
   ```

2. **Setup Backend**
   ```bash
   cd backend
   npm install
   cp .env.example .env # Configure your DB and API keys
   npm run dev
   ```

3. **Setup Frontend**
   ```bash
   cd ../frontend
   npm install
   npm run dev
   ```

---

## 🏗️ Architecture

Corre follows a modern full-stack architecture:
- **`frontend/`**: A highly responsive React SPA optimized for mobile and desktop.
- **`backend/`**: A robust Express API handling user synchronization, transaction logging, and gas sponsorship logic.
- **`worker/` (Inngest)**: Background processing for transaction verification and referral rewards.

## 📜 Documentation
- [Gas Sponsorship Security](GAS_SPONSORSHIP_SECURITY.md) - Details on our anti-abuse implementation.
- [Privy Webhook Setup](PRIVY_WEBHOOK_SETUP.md) - Guide for configuring authentication hooks.

---

<div align="center">
  <p>Built with ❤️ for the future of finance.</p>
  <p><b>Corre Beta</b> — Join the revolution.</p>
</div>
