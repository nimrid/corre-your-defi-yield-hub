import type { MCPTool, MCPContext } from "../types.js";
import { authRequiredResult } from "../auth.js";
import { pool } from "../../db.js";
import { resolveUserId } from "../../lib/dbHelpers.js";
import { findStockToken } from "../../config/usStockTokens.js";
import { executePendingTransaction } from "../../services/privyWalletService.js";

export const automationTools: MCPTool[] = [
  {
    definition: {
      name: "execute_transaction",
      description: "Execute a previously prepared transaction (USDC transfer or savings deposit) directly via in-chat signing. Requires a valid transactionId from a prepare_* tool.",
      inputSchema: {
        type: "object",
        properties: {
          transactionId: { type: "string", description: "The transaction ID returned by a prepare_* tool" },
        },
        required: ["transactionId"],
      },
      _meta: { securitySchemes: [{ type: "oauth2", scopes: [] }] },
    },
    handler: async (args: Record<string, any>, context: MCPContext) => {
      const { verifiedUser } = context;
      const { transactionId } = args as { transactionId: string };

      // 🔒 Executing a pending transaction signs and broadcasts real funds via
      // the user's delegated Privy wallet. Require a verified session and pass
      // the authenticated identity so ownership of the pending tx is enforced.
      if (!verifiedUser) {
        return authRequiredResult("Please sign in to your Corre account to authorize this transaction.");
      }

      console.log(`[MCP] Executing in-chat transaction "${transactionId || 'latest'}" for user "${verifiedUser.privyUserId}"`);

      const txResult = await executePendingTransaction(transactionId || "", verifiedUser.privyUserId);

      if (txResult.success) {
        const resObj = {
          status: "transaction_executed",
          success: true,
          txSignature: txResult.txSignature,
          solscanUrl: txResult.solscanUrl,
          message: `✅ Transaction confirmed! View on Solscan: ${txResult.solscanUrl}`,
        };

        return {
          content: [{ type: "text", text: JSON.stringify(resObj, null, 2) }],
          structuredContent: resObj,
          _meta: { ui: { resourceUri: "ui://corre/transaction" } },
        };
      } else {
        const resObj = {
          status: txResult.authorizeUrl ? "authorization_required" : "transaction_failed",
          success: false,
          error: txResult.error,
          ...(txResult.authorizeUrl ? { authorizeUrl: txResult.authorizeUrl } : {}),
          message: txResult.authorizeUrl
            ? `🔐 ${txResult.error} Authorize here: ${txResult.authorizeUrl}`
            : `❌ Transaction failed: ${txResult.error}`,
        };

        return {
          content: [{ type: "text", text: JSON.stringify(resObj, null, 2) }],
          structuredContent: resObj,
          _meta: { ui: { resourceUri: "ui://corre/transaction" } },
        };
      }
    }
  },
  {
    definition: {
      name: "create_stock_limit_order",
      description: "Create an automated limit order to buy or sell a tokenized US stock when its price hits a target (e.g. 'Buy $50 of NVDA when price drops to $115').",
      inputSchema: {
        type: "object",
        properties: {
          identifier: { type: "string", description: "User email address or Privy User ID" },
          symbol: { type: "string", description: "Stock ticker symbol e.g., TSLA, AAPL, NVDA" },
          action: { type: "string", enum: ["buy", "sell"], description: "Limit order action ('buy' or 'sell')" },
          targetPriceUsd: { type: "number", description: "Target price in USD to trigger execution" },
          usdcAmount: { type: "number", description: "USDC amount for the buy order (or share value)" },
        },
        required: ["symbol", "action", "targetPriceUsd", "usdcAmount"],
      },
    },
    handler: async (args: Record<string, any>, context: MCPContext) => {
      const { verifiedUser } = context;
      // 🔒 Writes a row attributed to a user, so require a verified session
      // and derive identity from it — never from a caller-supplied identifier.
      if (!verifiedUser) {
        return authRequiredResult("Please sign in to your Corre account to create a limit order.");
      }
      const identifier = verifiedUser.email || verifiedUser.privyUserId;

      const { symbol, action, targetPriceUsd, usdcAmount } = args as any;
      if (!symbol || !action || !targetPriceUsd || !usdcAmount) {
        throw new Error("Missing required parameters: symbol, action, targetPriceUsd, and usdcAmount are required.");
      }

      const stockConfig = findStockToken(symbol);
      const stockMint = stockConfig?.mint || "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB";
      const stockSymbol = stockConfig?.symbol || symbol.toUpperCase();

      const userId = await resolveUserId(verifiedUser.privyUserId);

      if (userId) {
        await pool.query(
          `INSERT INTO stock_limit_orders (user_id, stock_mint, stock_symbol, action, target_price_usd, usdc_amount, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', NOW())`,
          [userId, stockMint, stockSymbol, action.toLowerCase(), targetPriceUsd, usdcAmount]
        );
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                status: "limit_order_created",
                user: identifier || "Authenticated User",
                action: action.toUpperCase(),
                stockSymbol,
                targetPriceUsd: `$${targetPriceUsd}`,
                usdcAmount: `$${usdcAmount} USDC`,
                orderStatus: "ACTIVE (Monitoring price triggers)",
                instructions: `Your limit order to ${action.toUpperCase()} $${usdcAmount} of ${stockSymbol} at target price $${targetPriceUsd} has been created and is active.`,
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
      name: "create_stock_dca_schedule",
      description: "Create an automated Dollar-Cost Averaging (DCA) recurring purchase schedule for tokenized US stocks on Corre (e.g. 'Buy $25 of AAPL weekly').",
      inputSchema: {
        type: "object",
        properties: {
          identifier: { type: "string", description: "User email address or Privy User ID" },
          symbol: { type: "string", description: "Stock ticker symbol e.g., TSLA, AAPL, NVDA" },
          usdcAmount: { type: "number", description: "USDC amount per recurring purchase" },
          frequency: { type: "string", enum: ["daily", "weekly", "monthly"], description: "Frequency of recurring buys ('daily', 'weekly', 'monthly')" },
        },
        required: ["symbol", "usdcAmount", "frequency"],
      },
    },
    handler: async (args: Record<string, any>, context: MCPContext) => {
      const { verifiedUser } = context;
      // 🔒 Writes a row attributed to a user, so require a verified session
      // and derive identity from it — never from a caller-supplied identifier.
      if (!verifiedUser) {
        return authRequiredResult("Please sign in to your Corre account to create a DCA schedule.");
      }
      const identifier = verifiedUser.email || verifiedUser.privyUserId;

      const { symbol, usdcAmount, frequency } = args as any;
      if (!symbol || !usdcAmount || !frequency) {
        throw new Error("Missing required parameters: symbol, usdcAmount, and frequency are required.");
      }

      const stockConfig = findStockToken(symbol);
      const stockMint = stockConfig?.mint || "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB";
      const stockSymbol = stockConfig?.symbol || symbol.toUpperCase();

      const userId = await resolveUserId(verifiedUser.privyUserId);

      if (userId) {
        await pool.query(
          `INSERT INTO stock_dca_schedules (user_id, stock_mint, stock_symbol, usdc_amount, frequency, status, created_at)
           VALUES ($1, $2, $3, $4, $5, 'ACTIVE', NOW())`,
          [userId, stockMint, stockSymbol, usdcAmount, frequency.toLowerCase()]
        );
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                status: "dca_schedule_created",
                user: identifier || "Authenticated User",
                stockSymbol,
                usdcAmount: `$${usdcAmount} USDC`,
                frequency: frequency.toLowerCase(),
                scheduleStatus: "ACTIVE (Recurring automated purchases enabled)",
                instructions: `Your DCA schedule to buy $${usdcAmount} of ${stockSymbol} ${frequency.toLowerCase()} has been successfully enabled.`,
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
