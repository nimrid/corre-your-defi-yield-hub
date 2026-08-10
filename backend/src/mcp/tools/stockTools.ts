import type { MCPTool, MCPContext } from "../types.js";
import { authRequiredResult } from "../auth.js";
import { pool } from "../../db.js";
import { resolveUserId } from "../../lib/dbHelpers.js";
import { US_STOCK_TOKENS, findStockToken } from "../../config/usStockTokens.js";
import { lookupUserWallet, storePendingTransaction, validateInChatAmount, generateTransactionId } from "../../services/privyWalletService.js";

export const stockTools: MCPTool[] = [
  {
    definition: {
      name: "list_available_stocks",
      description: "Search, lookup, browse, or list all available tokenized US stocks & equities supported on Corre (TSLA, AAPL, NVDA, GOOGL, AMZN, META, COIN, HOOD, SP500...)",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Optional search query or company/ticker name (e.g. Tesla, Apple, NVDA, Tech)" },
        },
      },
    },
    handler: async (args: Record<string, any>, context: MCPContext) => {
      const query = ((args?.query || args?.symbol || "") as string).trim().toLowerCase();
      let filtered = US_STOCK_TOKENS;
      if (query) {
        filtered = US_STOCK_TOKENS.filter(
          (t) => t.symbol.toLowerCase().includes(query) || t.name.toLowerCase().includes(query)
        );
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                status: "success",
                searchQuery: query || "all",
                totalStocks: filtered.length,
                availableStocks: filtered,
                note: "You can buy fractional shares of any of these US equities starting from $5 on Corre.",
              },
              null,
              2
            ),
          },
        ],
      };
    }
  },
  {
    definition: {
      name: "search_tokenized_stocks",
      description: "Search, lookup, and query available tokenized US stocks, ticker symbols, and prices on Corre (e.g. search for Apple, Tesla, Nvidia, Tech stocks, etc.)",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query or ticker symbol (e.g. Tesla, AAPL, Nvidia, Tech)" },
        },
      },
    },
    handler: async (args: Record<string, any>, context: MCPContext) => {
      const query = ((args?.query || args?.symbol || "") as string).trim().toLowerCase();
      let filtered = US_STOCK_TOKENS;
      if (query) {
        filtered = US_STOCK_TOKENS.filter(
          (t) => t.symbol.toLowerCase().includes(query) || t.name.toLowerCase().includes(query)
        );
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                status: "success",
                searchQuery: query || "all",
                totalStocks: filtered.length,
                availableStocks: filtered,
                note: "You can buy fractional shares of any of these US equities starting from $5 on Corre.",
              },
              null,
              2
            ),
          },
        ],
      };
    }
  },
  {
    definition: {
      name: "get_stock_quote",
      description: "Get real-time price quote for tokenized US stocks by ticker symbol (e.g. AAPL, TSLA, NVDA) or Solana mint address",
      inputSchema: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Stock ticker symbol e.g., TSLA, AAPL, NVDA, GOOGL" },
          stockMint: { type: "string", description: "Solana mint address (optional if symbol provided)" },
          usdcAmount: { type: "number", description: "USDC amount to spend (optional, defaults to $100 for price estimate)" },
        },
        required: [],
      },
    },
    handler: async (args: Record<string, any>, context: MCPContext) => {
      const symbolInput = args?.symbol as string | undefined;
      const mintInput = args?.stockMint as string | undefined;
      const rawUsdc = args?.usdcAmount as number | undefined;
      const usdcAmount = rawUsdc && isFinite(rawUsdc) && rawUsdc > 0 ? rawUsdc : 100;

      const stockConfig = symbolInput ? findStockToken(symbolInput) : (mintInput ? findStockToken(mintInput) : undefined);
      const stockMint = stockConfig?.mint || mintInput || "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB";

      const rawAmount = Math.round(usdcAmount * 1_000_000);
      const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

      let url = `https://quote-api.jup.ag/v6/quote?inputMint=${USDC_MINT}&outputMint=${stockMint}&amount=${rawAmount}&slippageBps=100`;
      const headers: Record<string, string> = {};
      const jupApiKey = process.env.VITE_JUP_API_KEY || process.env.JUPITER_API_KEY;
      if (jupApiKey) {
        headers["x-api-key"] = jupApiKey;
      }

      let res = await fetch(url, { headers });
      if (!res.ok) {
        url = `https://api.jup.ag/swap/v2/quote?inputMint=${USDC_MINT}&outputMint=${stockMint}&amount=${rawAmount}`;
        res = await fetch(url, { headers });
      }
      const data = await res.json().catch(() => null);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                stockName: stockConfig?.name || "Tokenized US Stock",
                symbol: stockConfig?.symbol || symbolInput || "STOCK",
                mint: stockMint,
                usdcInput: usdcAmount,
                jupiterQuote: data,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  },
  {
    definition: {
      name: "prepare_buy_stock",
      description: "Prepare a buy order for tokenized stock (TSLA, AAPL, NVDA...) and generate checkout link",
      inputSchema: {
        type: "object",
        properties: {
          identifier: { type: "string", description: "User email address or Privy User ID" },
          symbol: { type: "string", description: "Stock Ticker e.g., AAPL, TSLA, NVDA, AMZN" },
          stockMint: { type: "string", description: "Solana token mint address (optional if symbol provided)" },
          usdcAmount: { type: "number", description: "USDC purchase amount" },
        },
        required: ["usdcAmount"],
      },
      _meta: { ui: { resourceUri: "ui://corre/transaction" }, securitySchemes: [{ type: "oauth2", scopes: [] }] },
    },
    handler: async (args: Record<string, any>, context: MCPContext) => {
      const { verifiedUser, getAppBaseUrl } = context;
      const { symbol, stockMint: mintInput, usdcAmount } = args as any;
      if (!usdcAmount || !isFinite(usdcAmount) || usdcAmount <= 0) {
        throw new Error("Invalid USDC amount. Please provide a positive number.");
      }

      if (!verifiedUser) {
        return authRequiredResult("Please sign in to your Corre account to authorize this purchase.");
      }

      const stockConfig = symbol ? findStockToken(symbol) : (mintInput ? findStockToken(mintInput) : undefined);
      const stockMint = stockConfig?.mint || mintInput || "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB";
      const stockSymbol = stockConfig?.symbol || symbol || "STOCK";

      const deepLink = `${getAppBaseUrl()}/invest/us-stocks/${stockMint}?amount=${usdcAmount}&action=buy`;

      let canExecuteInChat = false;
      let transactionId: string | undefined;
      const amountCheck = validateInChatAmount(usdcAmount);

      if (amountCheck.valid && verifiedUser) {
        const wallet = await lookupUserWallet(verifiedUser.privyUserId);
        if (wallet && wallet.walletAddress) {
          transactionId = generateTransactionId();
          canExecuteInChat = Boolean(wallet.walletId && wallet.walletId.length > 5);
          await storePendingTransaction({
            id: transactionId,
            type: "stock_buy",
            privyUserId: verifiedUser.privyUserId,
            walletAddress: wallet.walletAddress,
            walletId: wallet.walletId,
            usdcAmount,
            stockSymbol,
            stockMint,
            createdAt: Date.now(),
            executed: false,
          });
        }
      }

      const resObj = {
        status: "buy_order_prepared",
        user: verifiedUser ? (verifiedUser.email || "Authenticated User") : "Authenticated User",
        stockName: stockConfig?.name || stockSymbol,
        stockSymbol,
        stockMint,
        usdcAmount,
        checkoutUrl: deepLink,
        canExecuteInChat,
        transactionId,
        instructions: canExecuteInChat
          ? `ACTION REQUIRED BY ASSISTANT: An interactive transaction confirmation widget has been rendered directly in the chat window. DO NOT redirect the user to an external link. Instruct the user to click the "Confirm Transaction" button inside the chat widget to authorize and buy $${usdcAmount} of ${stockSymbol}.`
          : `To complete your purchase of $${usdcAmount} of ${stockSymbol}, click here: ${deepLink}`,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(resObj, null, 2) }],
        structuredContent: resObj,
        _meta: { ui: { resourceUri: "ui://corre/transaction" } },
      };
    }
  },
  {
    definition: {
      name: "prepare_sell_stock",
      description: "Prepare a sell order for tokenized stock shares back to USDC",
      inputSchema: {
        type: "object",
        properties: {
          identifier: { type: "string", description: "User email address or Privy User ID" },
          symbol: { type: "string", description: "Stock Ticker e.g., AAPL, TSLA, NVDA" },
          stockMint: { type: "string", description: "Solana token mint address (optional if symbol provided)" },
          sharesAmount: { type: "number", description: "Number of shares to sell" },
        },
        required: ["sharesAmount"],
      },
      _meta: { ui: { resourceUri: "ui://corre/transaction" }, securitySchemes: [{ type: "oauth2", scopes: [] }] },
    },
    handler: async (args: Record<string, any>, context: MCPContext) => {
      const { verifiedUser, getAppBaseUrl } = context;
      const { symbol, stockMint: mintInput, sharesAmount } = args as any;
      if (!sharesAmount || !isFinite(sharesAmount) || sharesAmount <= 0) {
        throw new Error("Invalid shares amount. Please provide a positive number.");
      }

      if (!verifiedUser) {
        return authRequiredResult("Please sign in to your Corre account to authorize this sale.");
      }

      const stockConfig = symbol ? findStockToken(symbol) : (mintInput ? findStockToken(mintInput) : undefined);
      const stockMint = stockConfig?.mint || mintInput || "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB";
      const stockSymbol = stockConfig?.symbol || symbol || "STOCK";

      const deepLink = `${getAppBaseUrl()}/invest/us-stocks/${stockMint}?shares=${sharesAmount}&action=sell`;

      let canExecuteInChat = false;
      let transactionId: string | undefined;

      if (verifiedUser) {
        const wallet = await lookupUserWallet(verifiedUser.privyUserId);
        if (wallet && wallet.walletAddress) {
          transactionId = generateTransactionId();
          canExecuteInChat = Boolean(wallet.walletId && wallet.walletId.length > 5);
          await storePendingTransaction({
            id: transactionId,
            type: "stock_sell",
            privyUserId: verifiedUser.privyUserId,
            walletAddress: wallet.walletAddress,
            walletId: wallet.walletId,
            usdcAmount: 0,
            stockSymbol,
            stockMint,
            sharesAmount,
            createdAt: Date.now(),
            executed: false,
          });
        }
      }

      const resObj = {
        status: "sell_order_prepared",
        user: verifiedUser ? (verifiedUser.email || "Authenticated User") : "Authenticated User",
        stockName: stockConfig?.name || stockSymbol,
        stockSymbol,
        stockMint,
        sharesAmount,
        checkoutUrl: deepLink,
        canExecuteInChat,
        transactionId,
        instructions: canExecuteInChat
          ? `ACTION REQUIRED BY ASSISTANT: An interactive transaction confirmation widget has been rendered directly in the chat window. DO NOT redirect the user to an external link. Instruct the user to click the "Confirm Transaction" button inside the chat widget to authorize and sell ${sharesAmount} shares of ${stockSymbol}.`
          : `To complete selling ${sharesAmount} shares of ${stockSymbol}, click here: ${deepLink}`,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(resObj, null, 2) }],
        structuredContent: resObj,
        _meta: { ui: { resourceUri: "ui://corre/transaction" } },
      };
    }
  },
  {
    definition: {
      name: "get_stock_market_trends",
      description: "Get real-time market trends, top gaining tokenized US stocks, 24h performance, and volume leaders available on Corre (e.g. TSLA, AAPL, NVDA, GOOGL, AMZN, META, COIN, HOOD, SP500...)",
      inputSchema: {
        type: "object",
        properties: {
          category: { type: "string", enum: ["all", "top_gainers", "tech", "popular"], description: "Category filter (default: all)" },
          limit: { type: "number", description: "Number of stocks to return (default: 10)" },
        },
      },
    },
    handler: async (args: Record<string, any>, context: MCPContext) => {
      const category = (args?.category as string) || "all";
      const limit = Math.min(Math.max(Number(args?.limit || 10), 1), 25);

      let filtered = US_STOCK_TOKENS;
      if (category === "tech") {
        filtered = US_STOCK_TOKENS.filter((t) =>
          ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "SKHY", "TTWO", "BOT", "SNDK"].includes(t.symbol)
        );
      } else if (category === "popular") {
        filtered = US_STOCK_TOKENS.filter((t) =>
          ["TSLA", "AAPL", "NVDA", "COIN", "HOOD", "SP500"].includes(t.symbol)
        );
      }

      const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
      const headers: Record<string, string> = {};
      const jupApiKey = process.env.VITE_JUP_API_KEY || process.env.JUPITER_API_KEY;
      if (jupApiKey) {
        headers["x-api-key"] = jupApiKey;
      }

      // Fetch real current prices from Jupiter in parallel (100 USDC per stock)
      const pricePromises = filtered.slice(0, limit).map(async (stock) => {
        try {
          const url = `https://quote-api.jup.ag/v6/quote?inputMint=${USDC_MINT}&outputMint=${stock.mint}&amount=100000000&slippageBps=100`;
          const res = await fetch(url, { headers });
          if (!res.ok) throw new Error(`${res.status}`);
          const data = await res.json();
          const outAmount = data?.outAmount ? Number(data.outAmount) / 1_000_000 : null;
          const pricePerShare = outAmount ? (100 / outAmount).toFixed(4) : null;
          return {
            symbol: stock.symbol,
            name: stock.name,
            mint: stock.mint,
            currentPriceUsd: pricePerShare ? `$${pricePerShare}` : "N/A",
            category: ["NVDA", "AAPL", "MSFT", "GOOGL", "AMZN", "META"].includes(stock.symbol) ? "Tech" : "Equities",
          };
        } catch (err) {
          return {
            symbol: stock.symbol,
            name: stock.name,
            mint: stock.mint,
            currentPriceUsd: "N/A",
            category: ["NVDA", "AAPL", "MSFT", "GOOGL", "AMZN", "META", "SKHY", "TTWO", "BOT", "SNDK"].includes(stock.symbol) ? "Tech" : "Equities",
          };
        }
      });

      const trendItems = await Promise.all(pricePromises);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                status: "success",
                category,
                totalReturned: trendItems.length,
                stocks: trendItems,
                note: "Prices are real-time Jupiter swap quotes for 100 USDC. Use get_stock_quote or prepare_buy_stock to get quotes for specific amounts or place orders.",
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }
];
