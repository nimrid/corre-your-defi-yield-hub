# Corre: Decentralized Yield Hub & Capital Markets on Solana 🌐⚡

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Network: Solana](https://img.shields.io/badge/Network-Solana-9945FF?logo=solana&logoColor=white)](https://solana.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-Backend-000000?logo=express&logoColor=white)](https://expressjs.com/)

**Corre** is a high-performance decentralized finance platform and capital markets gateway built on Solana. It bridges real-world assets, automated yield optimization, and AI agent execution into an accessible, gas-optimized web application.

---

## ⚡ Core Capabilities

### 💰 High-Yield USDC Savings
- **Standard Savings Vault**: Automated yield strategies targeting ~8.5% APY via institutional-grade lending protocols (Lulo).
- **Shielded Savings Vault**: Curated capital-preservation vault (~6.2% APY) with tight collateralization limits.
- **Real-Time Interest Accrual**: Track compounding returns by the second with zero lockup periods.

### 📈 Tokenized US Equities & Capital Markets
- **Fractional US Stocks**: Trade tokenized shares of leading US companies (NVDA, AAPL, MSFT, TSLA, SPY, and more) 24/7 on Solana.
- **Deep Liquidity Routing**: Best-price execution through Jupiter swap aggregators.
- **Interactive Charting**: Embedded TradingView analytics and Pyth oracle price feeds.

### 💸 Fast Transfers & Global Ramping
- **Direct Solana Transfers**: Send USDC and SOL to any Solana wallet address with automatic recipient Associated Token Account (ATA) creation.
- **Cross-Border Fiat Ramps**: Direct bank deposits and withdrawals with optimized corridors for African markets (Naira/NGN via Paj Ramp).
- **Gas-Sponsored Experience**: Eligible transactions execute completely gasless through Privy embedded wallets and backend fee sponsorship.

---

## 🤖 AI Ecosystem (Model Context Protocol)

Corre is built for agentic finance, providing a Remote MCP Server:

* **Remote MCP Server (`mcp.corre.bond`)**:
  * Production SSE endpoint for ChatGPT, Claude, Cursor, and autonomous agents.
  * Read vault rates, retrieve stock prices, and prepare transactions with deep-link authorizations.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui, Radix UI, Lucide Icons |
| **Blockchain / Web3** | Solana (`@solana/web3.js`, `@solana/spl-token`), Jupiter API, Lulo Protocol |
| **AI Protocol** | Model Context Protocol SDK (`@modelcontextprotocol/sdk`) |
| **Backend API** | Node.js, Express, TypeScript, `@neondatabase/serverless` (WebSockets) |
| **Database & Caching** | PostgreSQL (Neon), Upstash Redis |
| **Authentication** | Privy (Embedded Solana wallets, Social & Email login) |
| **Automation** | Inngest (Background yield distribution, auto-claim processing) |

---

## 📁 Repository Structure

```
corre-your-defi-yield-hub/
├── frontend/               # React + Vite client application
│   ├── src/
│   │   ├── components/     # UI widgets, layout, navigation & status badges
│   │   ├── hooks/          # React Query & session monitoring hooks
│   │   ├── pages/          # Home, Savings, Stocks, Transfers & Admin
│   │   └── services/       # API client & backend routing helpers
├── backend/                # Express REST API & Remote MCP Server
│   ├── src/
│   │   ├── controllers/    # Route controllers for users, stocks, & transfers
│   │   ├── mcp/            # Remote MCP tools & SSE protocol handlers
│   │   ├── routes/         # Express endpoint definitions
│   │   ├── services/       # Privy wallet operations & gas sponsorship logic
│   │   └── db.ts           # PostgreSQL connection pool with WebSocket fallback
└── README.md               # Project overview
```

---

## 🚀 Getting Started

### Prerequisites
* **Node.js** (v18.x or higher)
* **npm** or **pnpm**
* **PostgreSQL** database (e.g. Neon)
* **Privy App ID & Secret**

### 1. Clone & Install
```bash
git clone https://github.com/nimrid/corre-your-defi-yield-hub.git
cd corre-your-defi-yield-hub
```

### 2. Configure Backend
```bash
cd backend
npm install
cp .env.example .env    # Populate DATABASE_URL, PRIVY_APP_ID, etc.
npm run dev             # Starts backend on http://localhost:4000
```

### 3. Configure Frontend
```bash
cd ../frontend
npm install
cp .env.example .env    # Populate VITE_PRIVY_APP_ID, VITE_SOLANA_RPC, etc.
npm run dev             # Starts frontend on http://localhost:8080
```

---

## 📜 Documentation

* 🌍 **[Frontend & African Stocks Architecture](frontend/README.md)** — Guide to client architecture, tokenized African equities ($DPRI), sovereign treasury bills ($NTBS5), and dual-currency (USDC/cNGN) rails.
* 🛡️ **[Gas Sponsorship Security](GAS_SPONSORSHIP_SECURITY.md)** — Anti-abuse rules, spending ceilings, and transaction rate limits.
* 🔐 **[Privy Webhook Setup](PRIVY_WEBHOOK_SETUP.md)** — Configuring user lifecycle hooks and Svix signature verification.

---

## 📄 License

This project is licensed under the **[MIT License](LICENSE)**.
