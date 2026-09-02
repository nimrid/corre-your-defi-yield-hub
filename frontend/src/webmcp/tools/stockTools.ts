import type { WebMcpTool, WebMcpContext } from "../types";

export interface StockTokenInfo {
  mint: string;
  name: string;
  symbol: string;
}

export const US_STOCK_TOKENS: StockTokenInfo[] = [
  { mint: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp", name: "Apple", symbol: "AAPL" },
  { mint: "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB", name: "Tesla", symbol: "TSLA" },
  { mint: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh", name: "Nvidia", symbol: "NVDA" },
  { mint: "XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN", name: "Google", symbol: "GOOGL" },
  { mint: "Xsa62P5mvPszXL1krVUnU5ar38bBSVcWAB6fmPCo5Zu", name: "Meta", symbol: "META" },
  { mint: "Xs3eBt7uRfJX8QUs4suhyU8p2M6DoUDrJyWBa8LLZsg", name: "Amazon", symbol: "AMZN" },
  { mint: "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W", name: "S&P 500", symbol: "SP500" },
  { mint: "Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ", name: "Nasdaq", symbol: "NASDAQ" },
  { mint: "Xs7ZdzSHLU9ftNJsii5fCeJhoRWSC32SQGzGQtePxNu", name: "Coinbase", symbol: "COIN" },
  { mint: "XsvNBAYkrDRNhA7wPHQfX3ZUXZyZLdnCQDfHZ56bzpg", name: "Robinhood", symbol: "HOOD" },
  { mint: "XsP7xzNPvEHS1m6qfanPUGjNmdnmsLKEoNAnHjdxxyZ", name: "MicroStrategy", symbol: "MSTRX" },
  { mint: "Xsv9hRk1z5ystj9MhnA7Lq4vjSsLwzL2nxrwmwtD3re", name: "Gold", symbol: "GOLD" },
  { mint: "Xs6B6zawENwAbWVi7w92rjazLuAr5Az59qgWKcNb45x", name: "Berkshire Hathaway", symbol: "BRK" },
  { mint: "XsqE9cRRpzxcGKDXj1BJ7Xmg4GRhZoyY1KpmGSxAWT2", name: "McDonald's", symbol: "MCD" },
  { mint: "XsaBXg8dU5cPM6ehmVctMkVqoiRG2ZjMo1cyBJ3AykQ", name: "Coca-Cola", symbol: "KO" },
  { mint: "XsjFwUPiLofddX5cWFHW35GCbXcSu1BCUGfxoQAQjeL", name: "Oracle", symbol: "ORCL" },
  { mint: "Xsf9mBktVB9BSU5kf4nHxPq5hCBJ2j2ui3ecFGxPRGc", name: "Gamestop", symbol: "GMEx" },
  { mint: "XsoBhf2ufR8fTyNSjqfU71DYGaE6Z3SUGAidpzriAA4", name: "Palantir", symbol: "PLTRx" },
  { mint: "Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw", name: "Anthropic Pre-Stock", symbol: "ANTHROPIC" },
  { mint: "PrekqLJvJ3qVdXmBGDiexvwUTF4rLFDa6HWS4HJbw9S", name: "Neuralink Pre-Stock", symbol: "NEURALINK" },
  { mint: "PresTj4Yc2bAR197Er7wz4UUKSfqt6FryBEdAriBoQB", name: "Anduril Pre-Stock", symbol: "ANDURIL" },
];

export const stockTools: (context: WebMcpContext) => WebMcpTool[] = (context) => [
  {
    name: "list_available_stocks",
    description: "Search, lookup, and list all US stocks & equities supported on Corre (AAPL, TSLA, NVDA, GOOGL, META, SP500, etc.).",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Optional search query or company/ticker name (e.g. Tesla, Apple, NVDA, Tech).",
        },
      },
      required: [],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
    },
    execute: async (args: { query?: string }) => {
      const q = (args?.query || "").trim().toLowerCase();
      context.emitToast("📊", "Searching Stocks", q ? `Filtering for "${q}"...` : "Loading available equities...");

      const filtered = q
        ? US_STOCK_TOKENS.filter(
            (t) => t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)
          )
        : US_STOCK_TOKENS;

      return {
        status: "success",
        total: filtered.length,
        stocks: filtered,
        note: "Fractional shares can be purchased starting from $5 on Corre with 0% commission.",
      };
    },
  },
  {
    name: "get_stock_quote",
    description: "Get real-time price quote and 24h market stats for a US stock or equity by ticker symbol (e.g. AAPL, TSLA, NVDA).",
    inputSchema: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "Stock ticker symbol, e.g. AAPL, TSLA, NVDA, GOOGL, SP500.",
        },
      },
      required: ["symbol"],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
    },
    execute: async (args: { symbol: string }) => {
      const sym = (args.symbol || "").trim().toUpperCase();
      if (!sym) {
        throw new Error("Please specify a stock ticker symbol (e.g. AAPL, TSLA, NVDA).");
      }

      context.emitToast("🔍", "Fetching Stock Quote", `Retrieving real-time price for ${sym}...`);

      const match = US_STOCK_TOKENS.find((s) => s.symbol.toUpperCase() === sym);
      if (!match) {
        throw new Error(`Stock ticker '${sym}' not found. Supported symbols include: AAPL, TSLA, NVDA, GOOGL, META, SP500, COIN, HOOD, AMZN.`);
      }

      let price = 0;
      let priceChange24h = 0;
      let marketCap = 0;

      // Try Jupiter search
      try {
        const jupUrl = `https://api.jup.ag/tokens/v2/search?query=${encodeURIComponent(match.mint)}`;
        const res = await fetch(jupUrl);
        if (res.ok) {
          const data = await res.json();
          const assetData = Array.isArray(data) ? data[0] : (data as any)?.tokens?.[0] || data;
          if (assetData) {
            price = Number(assetData.usdPrice || assetData.price || 0);
            priceChange24h = Number(assetData.stats24h?.priceChange || assetData.priceChange24h || 0);
            marketCap = Number(assetData.mcap || assetData.fdv || 0);
          }
        }
      } catch (err) {
        console.warn("[WebMCP] Jupiter price lookup failed, trying fallback:", err);
      }

      context.emitToast(
        "📈",
        `${sym} Quote`,
        price > 0 ? `$${price.toFixed(2)} (${priceChange24h >= 0 ? "+" : ""}${priceChange24h.toFixed(2)}%)` : `${sym} quote loaded`,
        "success"
      );

      return {
        status: "success",
        symbol: match.symbol,
        companyName: match.name,
        mintAddress: match.mint,
        currentPriceUSD: price > 0 ? Number(price.toFixed(2)) : "Price unavailable",
        priceChange24hPercent: Number(priceChange24h.toFixed(2)),
        marketCapUSD: marketCap > 0 ? marketCap : undefined,
        tradeUrl: `${window.location.origin}/invest/us-stocks/${match.mint}`,
      };
    },
  },
];
