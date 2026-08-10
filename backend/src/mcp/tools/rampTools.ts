import type { MCPTool, MCPContext } from "../types.js";
import { authRequiredResult } from "../auth.js";
import { pool } from "../../db.js";
import { resolveUserId } from "../../lib/dbHelpers.js";
import { fetchLiveNairaRate } from "../helpers/rates.js";
import { lookupUserWallet, storePendingTransaction, validateInChatAmount, generateTransactionId } from "../../services/privyWalletService.js";

export const rampTools: MCPTool[] = [
  {
    definition: {
      name: "get_naira_exchange_rate",
      description: "Get real-time NGN/USDC onramp exchange rate and calculate estimated USDC for a Naira (NGN) amount",
      inputSchema: {
        type: "object",
        properties: {
          nairaAmount: { type: "number", description: "Amount in Naira (NGN) to calculate estimated USDC" },
          usdcAmount: { type: "number", description: "Target USDC amount to calculate required Naira (NGN)" },
        },
      },
    },
    handler: async (args, context) => {
      const { nairaAmount, usdcAmount } = args as { nairaAmount?: number; usdcAmount?: number };

      const rate = await fetchLiveNairaRate("onRamp");

      let calculatedUSDC: number | undefined;
      let calculatedNGN: number | undefined;

      if (nairaAmount) {
        calculatedUSDC = Number((nairaAmount / rate).toFixed(2));
      }
      if (usdcAmount) {
        calculatedNGN = Math.ceil(usdcAmount * rate);
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                status: "success",
                currency: "NGN",
                targetAsset: "USDC",
                rateNgnPerUsdc: rate,
                formattedRate: `₦${rate.toLocaleString()} / USDC`,
                nairaInput: nairaAmount,
                estimatedUsdcReceived: calculatedUSDC,
                targetUsdcInput: usdcAmount,
                requiredNairaInput: calculatedNGN,
                minNairaAmount: 1000,
                feePolicy: "PAJ platform & network processing fees are automatically calculated and applied upon order creation.",
                instructions: "You can purchase USDC directly using your local Naira bank account on Corre.",
              },
              null,
              2
            ),
          },
        ],
      };
    },
  },
  {
    definition: {
      name: "prepare_buy_usdc_naira",
      description: "Prepare an order intent to purchase USDC directly with Naira (NGN) via local bank transfer and generate checkout link",
      inputSchema: {
        type: "object",
        properties: {
          identifier: { type: "string", description: "User email address or Privy User ID" },
          nairaAmount: { type: "number", description: "Amount of Naira (NGN) to spend (minimum ₦1,000)" },
        },
        required: ["nairaAmount"],
      },
      _meta: { ui: { resourceUri: "ui://corre/transaction" }, securitySchemes: [{ type: "oauth2", scopes: [] }] },
    },
    handler: async (args, context) => {
      // Onramp prepares a payment link for a specific user. Require authentication.
      if (!context.verifiedUser) {
        return authRequiredResult("Please sign in to your Corre account to purchase USDC with Naira.");
      }

      const identifier = context.verifiedUser.email || context.verifiedUser.privyUserId;
      const { nairaAmount } = args as { nairaAmount: number };

      if (!nairaAmount || !isFinite(nairaAmount) || nairaAmount <= 0) {
        return {
          isError: true,
          content: [{ type: "text", text: "Invalid Naira amount. Please provide a positive number." }],
        };
      }

      if (nairaAmount < 1000) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "Minimum amount to purchase USDC with Naira is ₦1,000.",
            },
          ],
        };
      }

      const rate = await fetchLiveNairaRate("onRamp");

      const estimatedUSDC = (nairaAmount / rate).toFixed(2);
      const deepLink = `${context.getAppBaseUrl()}/buy-usdc/naira?amount=${nairaAmount}`;

      const resObj = {
        status: "onramp_order_prepared",
        user: identifier || "Authenticated User",
        paymentCurrency: "NGN (Naira)",
        nairaAmount,
        formattedNaira: `₦${nairaAmount.toLocaleString()}`,
        rateNgnPerUsdc: rate,
        estimatedUsdcReceived: Number(estimatedUSDC),
        paymentMethod: "Local Bank Transfer",
        checkoutUrl: deepLink,
        feePolicy: "PAJ platform & processing fees are calculated upon order creation on the checkout page.",
        instructions: `To complete buying ~$${estimatedUSDC} USDC with ₦${nairaAmount.toLocaleString()}, click here: ${deepLink}`,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(resObj, null, 2) }],
        structuredContent: resObj,
        _meta: { ui: { resourceUri: "ui://corre/transaction" } },
      };
    },
  },
  {
    definition: {
      name: "get_offramp_exchange_rate",
      description: "Get real-time USDC/NGN offramp exchange rate and calculate estimated Naira (NGN) received for selling USDC to a bank account",
      inputSchema: {
        type: "object",
        properties: {
          usdcAmount: { type: "number", description: "USDC amount to sell/offramp" },
        },
      },
    },
    handler: async (args, context) => {
      const { usdcAmount } = args as { usdcAmount?: number };

      const rate = await fetchLiveNairaRate("offRamp");

      let calculatedNaira: number | undefined;
      if (usdcAmount) {
        calculatedNaira = Math.floor(usdcAmount * rate);
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                status: "success",
                sourceAsset: "USDC",
                targetCurrency: "NGN (Naira)",
                rateNgnPerUsdc: rate,
                formattedRate: `₦${rate.toLocaleString()} / USDC`,
                usdcInput: usdcAmount,
                estimatedNairaReceived: calculatedNaira ? `₦${calculatedNaira.toLocaleString()}` : undefined,
                rawNairaAmount: calculatedNaira,
                supportedPayoutMethods: ["Local Bank Transfer (Nigeria / Africa)"],
                feePolicy: "PAJ platform & network fees are calculated upon order creation on the checkout page.",
                instructions: "You can withdraw your USDC directly into your local bank account on Corre.",
              },
              null,
              2
            ),
          },
        ],
      };
    },
  },
  {
    definition: {
      name: "prepare_offramp_usdc",
      description: "Prepare an offramp order intent to withdraw/sell USDC directly to a local bank account (Naira / African Bank Transfer) and generate checkout link",
      inputSchema: {
        type: "object",
        properties: {
          identifier: { type: "string", description: "User email address or Privy User ID" },
          usdcAmount: { type: "number", description: "Amount of USDC to sell/offramp" },
        },
        required: ["usdcAmount"],
      },
      _meta: { ui: { resourceUri: "ui://corre/transaction" }, securitySchemes: [{ type: "oauth2", scopes: [] }] },
    },
    handler: async (args, context) => {
      if (!context.verifiedUser) {
        return authRequiredResult("Please sign in to your Corre account to withdraw USDC to your bank.");
      }
      const identifier = context.verifiedUser.email || context.verifiedUser.privyUserId;
      const { usdcAmount } = args as { usdcAmount: number };

      if (!usdcAmount || !isFinite(usdcAmount) || usdcAmount <= 0) {
        return {
          isError: true,
          content: [{ type: "text", text: "Invalid USDC amount. Please provide a positive number." }],
        };
      }

      const rate = await fetchLiveNairaRate("offRamp");

      const estimatedNaira = Math.floor(usdcAmount * rate);
      const deepLink = `${context.getAppBaseUrl()}/send/bank/africa?amount=${usdcAmount}`;

      const resObj = {
        status: "offramp_order_prepared",
        user: identifier || "Authenticated User",
        usdcAmount,
        rateNgnPerUsdc: rate,
        estimatedNairaReceived: `₦${estimatedNaira.toLocaleString()}`,
        payoutMethod: "Local Bank Transfer",
        checkoutUrl: deepLink,
        feePolicy: "PAJ platform & network fees are calculated upon order creation on the checkout page.",
        instructions: `To complete withdrawing $${usdcAmount} USDC to your bank account (~₦${estimatedNaira.toLocaleString()}), click here: ${deepLink}`,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(resObj, null, 2) }],
        structuredContent: resObj,
        _meta: { ui: { resourceUri: "ui://corre/transaction" } },
      };
    },
  },
  {
    definition: {
      name: "prepare_transfer_usdc",
      description: "Prepare a USDC token transfer on Solana. Renders an interactive transaction confirmation widget directly in chat for 1-click in-chat signing.",
      inputSchema: {
        type: "object",
        properties: {
          identifier: { type: "string", description: "Sender email address or Privy User ID" },
          recipientAddress: { type: "string", description: "Destination Solana wallet address" },
          usdcAmount: { type: "number", description: "Amount of USDC to send" },
        },
        required: ["recipientAddress", "usdcAmount"],
      },
      _meta: { ui: { resourceUri: "ui://corre/transaction" }, securitySchemes: [{ type: "oauth2", scopes: [] }] },
    },
    handler: async (args, context) => {
      const { recipientAddress, usdcAmount } = args as {
        recipientAddress: string;
        usdcAmount: number;
      };

      if (!recipientAddress || recipientAddress.length < 32 || recipientAddress.length > 44) {
        throw new Error("Invalid Solana wallet address. Must be a valid base58 public key.");
      }
      if (!usdcAmount || !isFinite(usdcAmount) || usdcAmount <= 0) {
        throw new Error("Invalid USDC amount. Please provide a positive number.");
      }

      const deepLink = `${context.getAppBaseUrl()}/send/wallet?address=${encodeURIComponent(recipientAddress)}&amount=${usdcAmount}&token=USDC`;

      // 🔒 Gate BEFORE anything is prepared. Return the standard MCP auth
      // challenge so the HOST (ChatGPT/Claude) shows its NATIVE reconnect
      // dialog. No transaction is prepared or stored for an unauthed user.
      if (!context.verifiedUser) {
        return authRequiredResult("Please sign in to your Corre account to authorize this transfer.");
      }

      let canExecuteInChat = false;
      let transactionId: string | undefined;
      const amountCheck = validateInChatAmount(usdcAmount);

      // 🔒 In-chat server-side signing moves real funds, so it is ONLY allowed
      // for a verified session. The wallet is resolved from the authenticated
      // identity — never from a caller-supplied `identifier` — to prevent one
      // user from signing out of another user's delegated wallet (IDOR).
      if (amountCheck.valid && context.verifiedUser) {
        const wallet = await lookupUserWallet(context.verifiedUser.privyUserId);
        if (wallet && wallet.walletAddress) {
          transactionId = generateTransactionId();
          canExecuteInChat = Boolean(wallet.walletId && wallet.walletId.length > 5);
          await storePendingTransaction({
            id: transactionId,
            type: "transfer",
            privyUserId: context.verifiedUser.privyUserId,
            walletAddress: wallet.walletAddress,
            walletId: wallet.walletId,
            usdcAmount,
            recipientAddress,
            createdAt: Date.now(),
            executed: false,
          });
        }
      }

      const resObj = {
        status: "transfer_prepared",
        sender: context.verifiedUser ? (context.verifiedUser.email || "Authenticated User") : "Authenticated User",
        recipientAddress,
        usdcAmount,
        chain: "Solana",
        asset: "USDC",
        checkoutUrl: deepLink,
        canExecuteInChat,
        transactionId,
        instructions: canExecuteInChat
          ? `ACTION REQUIRED BY ASSISTANT: An interactive transaction confirmation widget has been rendered directly in the chat window. DO NOT redirect the user to an external link or say that in-chat transfer is unsupported. Instruct the user to click the "Confirm Transaction" button inside the chat widget to authorize and broadcast the transfer.`
          : `To complete sending $${usdcAmount} USDC to ${recipientAddress}, click here: ${deepLink}`,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(resObj, null, 2) }],
        structuredContent: resObj,
        _meta: { ui: { resourceUri: "ui://corre/transaction" } },
      };
    },
  },
];
