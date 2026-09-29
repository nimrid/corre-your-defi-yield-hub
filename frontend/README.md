# Corre Frontend: African Stocks & DeFi Yield Hub 🌐⚡

[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Solana](https://img.shields.io/badge/Network-Solana_Mainnet-9945FF?logo=solana&logoColor=white)](https://solana.com/)
[![Privy](https://img.shields.io/badge/Auth-Privy_Embedded_Wallets-FF4088)](https://privy.io/)

The **Corre Frontend** is a high-velocity decentralized finance interface and capital markets gateway built on Solana. It enables retail and institutional investors worldwide to access high-yield USDC vaults, tokenized US equities, and a groundbreaking suite of **Tokenized African Stocks and Real-World Assets (RWAs)** with instant atomic settlement.

---

## 🌍 Spotlight: Tokenized African Stocks & RWAs

African capital markets represent a rapidly expanding economic frontier with over **$1.5 Trillion** in untapped enterprise and infrastructure value. Traditionally, international and retail participation has been hindered by complex cross-border banking restrictions, high foreign exchange frictions, and restrictive minimum ticket sizes.

Corre breaks down these barriers on Solana by pairing regulated Special Purpose Vehicle (SPV) custody structures with fractional tokenization and sub-second settlement.

### 🏛️ African Asset Portfolio

| Asset Symbol | Asset Name | Asset Class | Primary Issuer / Custodian | Target Yield / Upside | Base Settlement |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`DPRI`** | **Dangote Petroleum Refinery IPO** | Equity (Pre-IPO) | Anchoria Asset Managers / SPV | Capital appreciation + USD dividends | `cNGN` / `USDC` |
| **`NTBS5`** | **Nigerian Treasury Bill Series 5** | Sovereign Fund | Comercio Partners Asset Mgt | **16.50% APY** (Daily compounding) | `cNGN` / `USDC` |
| **`gNTB`** | **GetEquity Treasury Bills Fund** | Sovereign Fund | BAS Capital | **15.50% APY** (Daily compounding) | `cNGN` / `USDC` |

---

### 🛢️ Flagship Equity: Dangote Petroleum Refinery IPO (`$DPRI`)

The **Dangote Petroleum Refinery and Petrochemicals complex** located in the Lekki Free Zone near Lagos, Nigeria, is the **largest single-train refinery in the world** (650,000 barrels per day). It is widely anticipated to be the largest initial public offering in African capital markets history.

#### How Corre Tokenizes `$DPRI`:
1. **Ring-Fenced SPV Custody**: Institutional issuing partners subscribe to underlying shares held in a dedicated Special Purpose Vehicle (SPV) overseen by SEC-regulated custodian **Anchoria Asset Managers**.
2. **Fractional Tokenized Rights**: Investors hold digital representations on Solana verifying proportional economic interest, future dividend claims, and upside participation.
3. **USD Dividend Exposure**: Because the refinery exports refined products across global corridors, investors are positioned for dividend distributions payable in US Dollars or dollar-pegged stablecoins.
4. **Accessible Minimums**: Available from as little as **1 DPRI (~$12 USD / equivalent cNGN)**, democratizing institutional-scale opportunities.

---

### 📈 Sovereign Fixed Income: Nigerian Treasury Bills (`$NTBS5` & `$gNTB`)

Corre brings sovereign-grade African debt instruments on-chain:
- **`$NTBS5` (Comercio Partners)**: Delivers a fixed **16.50% APY** backed by Nigerian Federal Government Treasury Bills.
- **`$gNTB` (BAS Capital)**: Delivers **15.50% APY** yield with automated periodic distributions.
- **On-Chain Yield Compounding**: Accrues interest transparently, with liquidity redeemable on Solana into `cNGN` or auto-converted into `USDC`.
- **Accessible from ₦10,000 cNGN**: Allows local and global savers to lock in high real yields without bureaucratic paperwork.

---

## 💳 Dual-Currency Settlement Rails: USDC & cNGN

Corre bridges traditional African banking with decentralized global liquidity:

```
    ┌───────────────────────────┐         ┌───────────────────────────┐
    │    Global Investors       │         │    African Investors      │
    │      (USDC / SOL)         │         │    (Local Bank / NGN)     │
    └─────────────┬─────────────┘         └─────────────┬─────────────┘
                  │                                     │
                  │ (Direct Solana Swap)                │ (Paj Ramp Bank Onramp)
                  ▼                                     ▼
    ┌─────────────────────────────────────────────────────────────────┐
    │                     Corre Solana Liquidity                      │
    │           (Instant Swaps between USDC ⇆ cNGN)                    │
    └─────────────────────────────┬───────────────────────────────────┘
                                  │
                  ┌───────────────┴───────────────┐
                  ▼                               ▼
      ┌───────────────────────┐       ┌───────────────────────┐
      │  Dangote Refinery     │       │ Sovereign Treasury    │
      │  Pre-IPO Equity ($DPRI)│      │ Bills ($NTBS5 / $gNTB)│
      └───────────────────────┘       └───────────────────────┘
```

1. **Global USDC Entry**: Connect any Solana wallet or Privy embedded wallet and fund allocations directly using `USDC`.
2. **Local cNGN (Digital Naira) Entry**: Integrated fiat ramping through **Paj Ramp** lets users deposit via standard Nigerian bank transfers (NGN) to instantly receive `cNGN` on Solana with zero hidden fees.
3. **Frictionless Conversion**: Built-in automated routing allows 1-click swapping between `USDC` and `cNGN` on-chain.

---

## 🏗️ Architecture & Repository Structure

```
frontend/
├── public/                 # Static assets, brand logos (corre_logo.png), PWA manifests
├── src/
│   ├── components/         # UI component library (shadcn/ui, Radix primitives)
│   │   ├── rwa/            # African Stocks & RWA specialized widgets
│   │   │   ├── LegacyVentureDetailsView.tsx # Deal overview & order sheet
│   │   │   └── RwaHeaderMetrics.tsx         # Financial stats, yield & custody pill
│   │   ├── Navigation.tsx  # Header navigation bar with Privy auth & wallet modal
│   │   ├── ScrollToTop.tsx # Route change view restoration
│   │   └── ui/             # Reusable buttons, cards, toasts, modals, tooltips
│   ├── config/             # Market registries and asset metadata
│   │   ├── rwaTokens.ts    # Token definitions, mint addresses, decimals & issuers
│   │   ├── rwaTokenContent.ts # In-depth issuer backgrounds, custody terms & FAQs
│   │   └── usStockTokens.ts # Tokenized US equities directory (NVDA, AAPL, etc.)
│   ├── hooks/              # Custom application hooks
│   │   └── useSessionMonitor.ts # Inactive session detection & re-auth guards
│   ├── pages/              # Main route views
│   │   ├── Home.tsx        # Portfolio dashboard (US Stocks, African Stocks & Savings)
│   │   ├── Invest.tsx      # Main investment hub
│   │   ├── InvestPrivateMarket.tsx # African Stocks & RWAs catalog
│   │   ├── InvestPrivateMarketDetails.tsx # Detail & transaction view for $DPRI, $NTBS5
│   │   ├── SaveRegular.tsx # High-yield USDC Savings vault (Lulo)
│   │   ├── SaveProtected.tsx # Shielded USDC vault
│   │   ├── Send.tsx        # Solana & cross-border transfers
│   │   └── BuyUSDC.tsx     # Fiat ramp onboarding (Naira / Card / Bank)
│   ├── services/           # Backend API clients & fee sponsorship services
│   ├── App.tsx             # Root router, query clients & global toast providers
│   └── main.tsx            # Application entrypoint & Privy authentication provider
├── package.json            # Dependencies and npm script definitions
├── tsconfig.json           # TypeScript configuration
└── vite.config.ts          # Vite build, aliases, and PWA configuration
```

---

## 🔐 Security & Custody Standards

* **Privy Embedded Wallets**: Users can sign in with Email, SMS, or Google without managing raw private keys. An automated Solana key quorum provisions non-custodial wallets on-demand.
* **Gas-Sponsored Execution**: Onboarding transactions and key operations are fee-sponsored via backend relayer accounts, eliminating SOL gas friction for first-time African users.
* **SEC-Regulated Trust Structures**: Physical and synthetic shares are managed through registered institutional asset managers (**Anchoria**, **Comercio Partners**, **BAS Capital**) in compliance with local securities frameworks.
* **Non-Custodial Balance Tracking**: Token holdings exist as verifiable SPL tokens in the user's personal Solana wallet address.

---

## 🚀 Getting Started

### Prerequisites
* **Node.js** (v18.x or v20.x recommended)
* **npm** or **pnpm**
* A running Corre Backend instance (or production API endpoint)

### 1. Installation
Navigate to the `frontend/` directory and install project dependencies:

```bash
cd frontend
npm install
```

### 2. Environment Variables
Copy `.env.example` to `.env` and fill in the required RPC and service keys:

```bash
cp .env.example .env
```

Key environment configurations:
```env
# Privy Authentication
VITE_PRIVY_APP_ID=your_privy_app_id
VITE_PRIVY_SIGNER_ID=your_privy_signer_id

# Solana Network Configuration
VITE_SOLANA_RPC=https://api.mainnet-beta.solana.com
VITE_SOLANA_CLUSTER=mainnet-beta

# Backend API Endpoint
VITE_BACKEND_URL=http://localhost:4000

# RWA Mint Addresses (Solana Mainnet)
VITE_GETEQUITY_DPRI_MINT=4SARoiczTriUakwqmNtmP45hDrFV46umaJVwjQC8JLiK
VITE_GETEQUITY_GNTB_MINT=CsMkseiQZJiaXSyiE7NZayosWWQmycwdYxU85aYCxg5d
VITE_GETEQUITY_DEFAULT_PAYOUT_MINT=3jiqwBQVRC5zRwHyqvnkQurebJ5RNxg3F5fXMwaxgkv8 # cNGN Mint
```

### 3. Running Locally
Start the development server with live reload:

```bash
npm run dev
```

The application will be accessible at **`http://localhost:8080`** (or your designated Vite port).

### 4. Production Build
Validate types and compile the production bundle:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

---

## 🧪 Key Routes & Navigation

| Route | View Description |
| :--- | :--- |
| **`/home`** | Consolidated dashboard showing African stock balances, US stocks, and USDC vaults. |
| **`/invest/private-market`** | **African Stocks & RWAs Market**: Browse Dangote Refinery ($DPRI), Treasury Bills ($NTBS5, $gNTB). |
| **`/invest/private-market/:id`** | Detailed prospectus, issuer financials, risk disclosures, and buy order flow. |
| **`/save`** | USDC Savings Vaults (8.5% APY via Lulo). |
| **`/buy-usdc`** | Fiat Onramp (including African Bank Transfers via Paj Ramp). |
| **`/send/wallet`** | Direct Solana SPL Token & USDC transfers. |

---

## 📄 License
This module is distributed under the **MIT License**.
