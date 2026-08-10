import type { MCPTool, MCPContext } from "../types.js";
import { authRequiredResult } from "../auth.js";
import { pool } from "../../db.js";
import { resolveUserId } from "../../lib/dbHelpers.js";
import { fetchLiveLuloYields } from "../helpers/lulo.js";
import { lookupUserWallet, storePendingTransaction, validateInChatAmount, generateTransactionId } from "../../services/privyWalletService.js";

export const savingsTools: MCPTool[] = [
  {
    definition: {
      name: "get_savings_yield",
      description: "Get current APY yield rates for Standard (~8.5% APY) and Shielded (~6.2% APY) USDC savings vaults",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    handler: async (args: Record<string, any>, context: MCPContext) => {
      const yields = await fetchLiveLuloYields();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                status: "success",
                standardVaultAPY: yields.standardVaultAPY,
                shieldedVaultAPY: yields.shieldedVaultAPY,
                shieldedVaultFeatures: [
                  "Enhanced security parameters",
                  "Protected yield balance (pUSD balance tracking)",
                  "Automated interest accumulation",
                ],
                asset: "USDC",
                managementProtocol: "Lulo / LI.FI",
                shieldedDepositUrl: `${context.getAppBaseUrl()}/save/protected`,
                standardDepositUrl: `${context.getAppBaseUrl()}/save/regular`,
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
      name: "prepare_savings_deposit",
      description: "Prepare a USDC deposit into Corre Savings Vault (Shielded Vault ~6.2% APY or Standard Vault ~8.5% APY). Renders an interactive transaction confirmation widget directly in chat for 1-click in-chat signing.",
      inputSchema: {
        type: "object",
        properties: {
          identifier: { type: "string", description: "User email address or Privy User ID" },
          vaultType: { type: "string", enum: ["shielded", "standard"], description: "Vault type: 'shielded' for Protected Savings or 'standard' for Standard Savings (default: shielded)" },
          usdcAmount: { type: "number", description: "Amount of USDC to deposit" },
        },
        required: ["usdcAmount"],
      },
      _meta: { ui: { resourceUri: "ui://corre/transaction" }, securitySchemes: [{ type: "oauth2", scopes: [] }] },
    },
    handler: async (args: Record<string, any>, context: MCPContext) => {
      const { verifiedUser, getAppBaseUrl } = context;
      if (!verifiedUser) {
        return authRequiredResult("Please sign in to your Corre account to deposit funds into savings.");
      }

      const { vaultType = "shielded", usdcAmount } = args as any;
      if (!usdcAmount || !isFinite(usdcAmount) || usdcAmount <= 0) {
        throw new Error("Invalid USDC amount. Please provide a positive number.");
      }

      const isShielded = vaultType.toLowerCase() === "shielded" || vaultType.toLowerCase() === "protected";
      const deepLink = isShielded
        ? `${getAppBaseUrl()}/save/protected?amount=${usdcAmount}`
        : `${getAppBaseUrl()}/save/regular?amount=${usdcAmount}`;

      let canExecuteInChat = false;
      let transactionId: string | undefined;
      const savingsAmountCheck = validateInChatAmount(usdcAmount);

      // 🔒 In-chat server-side signing moves real funds, so it is ONLY allowed
      // for a verified session. The wallet is resolved from the authenticated
      // identity — never from a caller-supplied `identifier` — to prevent one
      // user from signing out of another user's delegated wallet (IDOR).
      if (savingsAmountCheck.valid && verifiedUser) {
        const wallet = await lookupUserWallet(verifiedUser.privyUserId);
        if (wallet && wallet.walletAddress) {
          transactionId = generateTransactionId();
          canExecuteInChat = Boolean(wallet.walletId && wallet.walletId.length > 5);
          await storePendingTransaction({
            id: transactionId,
            type: "savings_deposit",
            privyUserId: verifiedUser.privyUserId,
            walletAddress: wallet.walletAddress,
            walletId: wallet.walletId,
            usdcAmount,
            vaultType: isShielded ? "shielded" : "standard",
            createdAt: Date.now(),
            executed: false,
          });
        }
      }

      const yields = await fetchLiveLuloYields();
      const estimatedAPY = isShielded ? `${yields.shieldedVaultAPY} APY` : `${yields.standardVaultAPY} APY`;

      const resObj = {
        status: "savings_deposit_prepared",
        user: verifiedUser ? (verifiedUser.email || "Authenticated User") : "Authenticated User",
        vaultType: isShielded ? "Shielded Savings Vault (Protected Yield)" : "Standard Savings Vault",
        estimatedAPY,
        usdcAmount,
        checkoutUrl: deepLink,
        canExecuteInChat,
        transactionId,
        instructions: canExecuteInChat
          ? `ACTION REQUIRED BY ASSISTANT: An interactive transaction confirmation widget has been rendered directly in the chat window. DO NOT redirect the user to an external link or say that in-chat deposit is unsupported. Instruct the user to click the "Confirm Transaction" button inside the chat widget to authorize the deposit.`
          : `To deposit $${usdcAmount} USDC into the ${isShielded ? "Shielded" : "Standard"} Vault, click here: ${deepLink}`,
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
      name: "prepare_savings_withdraw",
      description: "Prepare a USDC withdrawal from Corre Savings Vault (Shielded or Standard)",
      inputSchema: {
        type: "object",
        properties: {
          identifier: { type: "string", description: "User email address or Privy User ID" },
          vaultType: { type: "string", enum: ["shielded", "standard"], description: "Vault type: 'shielded' or 'standard'" },
          usdcAmount: { type: "number", description: "Amount of USDC to withdraw" },
        },
        required: ["usdcAmount"],
      },
      _meta: { ui: { resourceUri: "ui://corre/transaction" }, securitySchemes: [{ type: "oauth2", scopes: [] }] },
    },
    handler: async (args: Record<string, any>, context: MCPContext) => {
      const { verifiedUser, getAppBaseUrl } = context;
      const { vaultType = "shielded", usdcAmount } = args as any;
      if (!usdcAmount || !isFinite(usdcAmount) || usdcAmount <= 0) {
        throw new Error("Invalid USDC amount. Please provide a positive number.");
      }

      const isShielded = vaultType.toLowerCase() === "shielded" || vaultType.toLowerCase() === "protected";
      const deepLink = isShielded
        ? `${getAppBaseUrl()}/save/protected?action=withdraw&amount=${usdcAmount}`
        : `${getAppBaseUrl()}/save/regular?action=withdraw&amount=${usdcAmount}`;

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
            type: "savings_withdraw",
            privyUserId: verifiedUser.privyUserId,
            walletAddress: wallet.walletAddress,
            walletId: wallet.walletId,
            usdcAmount,
            vaultType: isShielded ? "shielded" : "standard",
            createdAt: Date.now(),
            executed: false,
          });
        }
      }

      const resObj = {
        status: "savings_withdrawal_prepared",
        user: verifiedUser ? (verifiedUser.email || "Authenticated User") : "Authenticated User",
        vaultType: isShielded ? "Shielded Savings Vault (Protected Yield)" : "Standard Savings Vault",
        usdcAmount,
        cooldownPeriod: isShielded ? "Instant (0 hours)" : "24 Hours (Cooldown Period)",
        checkoutUrl: deepLink,
        canExecuteInChat,
        transactionId,
        instructions: canExecuteInChat
          ? `ACTION REQUIRED BY ASSISTANT: An interactive transaction confirmation widget has been rendered directly in the chat window. ${isShielded ? "Shielded Vault withdrawals are instant." : "IMPORTANT: Standard Vault withdrawals enter a 24-hour cooldown period before final completion and wallet claim."}`
          : `To withdraw $${usdcAmount} USDC from your ${isShielded ? "Shielded" : "Standard"} Vault, click here: ${deepLink}`,
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
      name: "get_pending_withdrawals",
      description: "Get active Standard Vault pending withdrawals, 24-hour cooldown countdown timers, and background auto-claim status on Corre.",
      inputSchema: {
        type: "object",
        properties: {
          identifier: { type: "string", description: "User email address or Privy User ID" },
        },
      },
    },
    handler: async (args: Record<string, any>, context: MCPContext) => {
      const { verifiedUser } = context;
      // 🔒 Reads a user's private withdrawal data, so require a verified
      // session and derive identity from it — never from args.identifier.
      if (!verifiedUser) {
        return authRequiredResult("Please sign in to your Corre account to view your pending withdrawals.");
      }
      const identifier = verifiedUser.email || verifiedUser.privyUserId;

      let privyUserId = verifiedUser.privyUserId;
      if (identifier && identifier.includes("@")) {
        const uRes = await pool.query(`SELECT privy_user_id FROM users WHERE email = $1`, [identifier.toLowerCase()]);
        privyUserId = uRes.rows[0]?.privy_user_id || verifiedUser.privyUserId;
      }

      const res = await pool.query(
        `SELECT withdrawal_id, mint_address, native_amount, created_timestamp, cooldown_seconds, completed
           FROM pending_withdrawals
          WHERE privy_user_id = $1 AND completed = FALSE
          ORDER BY created_timestamp DESC`,
        [privyUserId]
      );

      const nowSec = Math.floor(Date.now() / 1000);
      const pendingList = res.rows.map((r) => {
        const createdSec = Number(r.created_timestamp || 0);
        const cooldownSec = Number(r.cooldown_seconds || 86400);
        const unlockSec = createdSec + cooldownSec;
        const remainingSec = Math.max(0, unlockSec - nowSec);

        const hoursLeft = Math.floor(remainingSec / 3600);
        const minsLeft = Math.floor((remainingSec % 3600) / 60);

        return {
          withdrawalId: r.withdrawal_id,
          amountUsdc: Number(r.native_amount) / 1_000_000,
          cooldownSeconds: cooldownSec,
          remainingSeconds: remainingSec,
          status: remainingSec === 0 ? "READY_TO_CLAIM (Background Auto-Claim Active)" : `COOLDOWN (${hoursLeft}h ${minsLeft}m remaining)`,
          canClaimNow: remainingSec === 0,
        };
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                status: "success",
                user: identifier || "Authenticated User",
                totalPendingCount: pendingList.length,
                pendingWithdrawals: pendingList,
                autoClaimNote: "Corre's background auto-claim worker automatically executes withdrawals when the 24-hour cooldown expires. No manual action is required.",
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
