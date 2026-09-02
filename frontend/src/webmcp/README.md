# Corre WebMCP (Web Model Context Protocol) 🌐🤖

[![Protocol: WebMCP](https://img.shields.io/badge/Protocol-WebMCP-7C3AED?logo=openai&logoColor=white)](https://github.com/nimrid/corre-your-defi-yield-hub)
[![Network: Solana](https://img.shields.io/badge/Network-Solana-9945FF?logo=solana&logoColor=white)](https://solana.com)
[![Status: Beta](https://img.shields.io/badge/Status-Live%20Beta-brightgreen)](#)

**Corre WebMCP** is an in-browser implementation of the Model Context Protocol (MCP). It bridges web-based AI agents, browser extensions, and developer assistants directly with Corre's Solana DeFi ecosystem.

Unlike remote backend MCP servers, WebMCP runs **client-side directly within the authenticated browser session**. This enables AI assistants to query balances, fetch real-time stock quotes, and initiate on-chain transactions using the user's connected wallet (Privy embedded or external Solana wallets) with optional gas sponsorship.

---

## 🏛️ Architecture & Discovery

WebMCP is automatically initialized on page mount and registers itself through multiple standard discovery channels:

1. **`window.__correWebMCP`**: Global browser API for web extensions, testing consoles, and client agents.
2. **`navigator.modelContext`**: Adheres to the emerging standard for browser-native AI context discovery.
3. **`WebMcpStatusBadge`**: Visual status indicator in the app header displaying live tool counts and connection health.

```
┌──────────────────────────────────────────────────────────┐
│                   Browser Environment                    │
│                                                          │
│  ┌───────────────────────┐      ┌─────────────────────┐  │
│  │ AI Agent / Extension  │      │  User React UI      │  │
│  └───────────┬───────────┘      └──────────┬──────────┘  │
│              │                             │             │
│              ▼                             ▼             │
│      window.__correWebMCP  ◄───►  useWebMcp Hook         │
│              │                                           │
│              ├─► savingsTools   (Yields & Vaults)        │
│              ├─► stockTools     (US Equities & Quotes)   │
│              ├─► transferTools  (Solana Transfers)       │
│              └─► portfolioTools (Account & Net Worth)    │
│                                                          │
│              ▼                             ▼             │
│      Privy Solana Wallet        Solana RPC / Lulo API    │
└──────────────────────────────────────────────────────────┘
```

---

## 🧰 Available Tools (8 Active Tools)

### 💰 Savings & Yield Tools

| Tool | Type | Description |
| :--- | :--- | :--- |
| `get_savings_yield` | Read-only | Returns real-time APY yield rates for Standard (~8.5% APY) and Shielded (~6.2% APY) USDC vaults. |
| `get_savings_balance` | Read-only | Queries the authenticated user's current vault balances, deposits, and accrued interest. |
| `deposit_savings_vault` | Transaction | Pre-validates wallet balance and deposits USDC into Shielded or Standard vaults with in-browser signing. |

### 📈 Stocks & Equities Tools

| Tool | Type | Description |
| :--- | :--- | :--- |
| `list_available_stocks` | Read-only | Searches and lists all supported US equities (AAPL, TSLA, NVDA, GOOGL, META, SP500, etc.). |
| `get_stock_quote` | Read-only | Fetches live market price quotes, 24h price change, and market cap for a given ticker symbol. |

### 💸 Transfers & Wallet Tools

| Tool | Type | Description |
| :--- | :--- | :--- |
| `send_to_solana_wallet` | Transaction | Transfers USDC or SOL to any Solana wallet address. Automatically creates recipient Associated Token Accounts (ATA) if needed. |
| `get_user_wallet` | Read-only | Retrieves the active user's connected Solana wallet address, authentication state, and network. |
| `get_user_portfolio` | Read-only | Aggregates user net worth in USD, liquid USDC, SOL balance, savings vaults, and equities. |

---

## 🔒 Security & Performance Features

1. **Pre-Flight Balance Validation**:
   * Transaction tools (`deposit_savings_vault`, `send_to_solana_wallet`) verify real-time on-chain balances prior to transaction construction, preventing failed simulations and wasted RPC calls.
2. **Gas Sponsorship**:
   * Outgoing transfers and vault deposits query `/gas-sponsorship/check`. Eligible transactions are automatically sponsored by the Corre fee payer.
3. **Automated ATA Provisioning**:
   * When sending USDC to a new wallet address, WebMCP detects whether the destination has a USDC Associated Token Account and bundles account initialization into the transaction.
4. **Strict Schema & Security Scanner Compliance**:
   * All tool definitions feature complete JSON Schemas (`required: [...]`, `additionalProperties: false`) and clean semantic descriptions that avoid false-positive auth token warnings.
5. **Infinite Loop Protection**:
   * The `useWebMcp` hook utilizes a stable Proxy pattern to decouple dynamic Privy wallet hooks from registration effects, ensuring zero unnecessary re-renders.

---

## 💻 Developer Usage

You can test and interact with WebMCP directly from the browser's Developer Console (`F12`):

### 1. List Available Tools
```javascript
const tools = window.__correWebMCP.listTools();
console.log(tools.map(t => t.name));
```

### 2. Query a Stock Quote
```javascript
const quote = await window.__correWebMCP.invoke("get_stock_quote", { 
  symbol: "NVDA" 
});
console.log(JSON.parse(quote.content[0].text));
```

### 3. Fetch Savings Vault Yields
```javascript
const yields = await window.__correWebMCP.invoke("get_savings_yield", {});
console.log(JSON.parse(yields.content[0].text));
```

### 4. Send USDC to a Wallet
```javascript
const transfer = await window.__correWebMCP.invoke("send_to_solana_wallet", {
  recipientAddress: "3XMA285Vp28m9gLgM3tBvK7p99w...",
  amount: 5,
  asset: "USDC"
});
console.log(JSON.parse(transfer.content[0].text));
```

---

## 📁 File Structure

```
frontend/src/webmcp/
├── README.md               # This documentation file
├── index.ts                # Main WebMCP module entry point
├── types.ts                # TypeScript interfaces for tools and context
├── useWebMcp.ts            # React hook managing lifecycle & registration
├── components/
│   └── WebMcpStatusBadge.tsx # UI status badge component in navigation
└── tools/
    ├── index.ts            # Aggregator for all WebMCP tool suites
    ├── savingsTools.ts     # Lulo savings vault integration tools
    ├── stockTools.ts       # US equities lookup and quote tools
    ├── transferTools.ts    # Direct Solana transfer tools
    ├── portfolioTools.ts   # User balance and portfolio tools
    └── rampTools.ts        # Legacy ramp tool exports
```
