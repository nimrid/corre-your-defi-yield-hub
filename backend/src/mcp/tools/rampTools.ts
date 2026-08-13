import type { MCPTool, MCPContext } from "../types.js";
import { authRequiredResult } from "../auth.js";
import { pool } from "../../db.js";
import { resolveUserId } from "../../lib/dbHelpers.js";
import { fetchLiveNairaRate } from "../helpers/rates.js";
import { lookupUserWallet, storePendingTransaction, validateInChatAmount, generateTransactionId } from "../../services/privyWalletService.js";
import { fetchSupportedBanks, resolveBank, saveBank, fetchSavedBankAccounts, createOfframp } from "../helpers/pajSession.js";
import { Currency, Chain } from "paj_ramp";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
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
      const PAJ_FEE_USDC = 0.5;

      let calculatedUSDC: number | undefined;
      let calculatedNGN: number | undefined;

      if (nairaAmount) {
        calculatedUSDC = Number(Math.max(0, (nairaAmount / rate) - PAJ_FEE_USDC).toFixed(2));
      }
      if (usdcAmount) {
        calculatedNGN = Math.ceil((usdcAmount + PAJ_FEE_USDC) * rate);
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
                feePolicy: "0.50 USDC platform & network processing fee is included in these estimates.",
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
      const PAJ_FEE_USDC = 0.5;

      const estimatedUSDC = Math.max(0, (nairaAmount / rate) - PAJ_FEE_USDC).toFixed(2);
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
        feePolicy: "0.50 USDC platform & network processing fee is included in the estimated amount.",
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
      const PAJ_FEE_USDC = 0.5;

      let calculatedNaira: number | undefined;
      if (usdcAmount) {
        calculatedNaira = Math.floor(Math.max(0, usdcAmount - PAJ_FEE_USDC) * rate);
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
                feePolicy: "0.50 USDC platform & network fee is subtracted before rate conversion.",
                instructions: "If the user wants to proceed, DO NOT ask for bank details immediately. First, call get_saved_bank_accounts to see if they have saved accounts. If they do, ask which one to use. If not, guide them to save a bank account first.",
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
      description: "Prepare an offramp order intent to withdraw/sell USDC directly to a local bank account. IMPORTANT: Do NOT ask the user for bank details manually. Always call get_saved_bank_accounts first. If they have a saved account, use its bankId and accountNumber here. If not, help them save one first.",
      inputSchema: {
        type: "object",
        properties: {
          identifier: { type: "string", description: "User email address or Privy User ID" },
          usdcAmount: { type: "number", description: "Amount of USDC to sell/offramp" },
          bankId: { type: "string", description: "Bank institution ID from get_supported_banks or get_saved_bank_accounts" },
          accountNumber: { type: "string", description: "10-digit Nigerian bank account number (NUBAN)" },
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
      const { usdcAmount, bankId, accountNumber } = args as { usdcAmount: number; bankId?: string; accountNumber?: string };

      if (!usdcAmount || !isFinite(usdcAmount) || usdcAmount <= 0) {
        return {
          isError: true,
          content: [{ type: "text", text: "Invalid USDC amount. Please provide a positive number." }],
        };
      }

      const rate = await fetchLiveNairaRate("offRamp");
      const PAJ_FEE_USDC = 0.5;
      const estimatedNaira = Math.floor(Math.max(0, usdcAmount - PAJ_FEE_USDC) * rate);

      if (bankId && accountNumber) {
        const webhookUrl = `${process.env.BACKEND_URL || process.env.APP_URL || 'http://localhost:3001'}/webhook/paj-ramp`;
        
        let bankName = "Unknown Bank";
        let accountName = "Unknown Account";
        let finalBankInstId = bankId;

        try {
          const savedAccounts = await fetchSavedBankAccounts(context.verifiedUser.privyUserId);
          const matchedAccount = savedAccounts.find(a => a.accountNumber === accountNumber && (a.id === bankId || a.bankId === bankId || a.bank?.includes(bankId) || true));
          if (matchedAccount) {
            bankName = matchedAccount.bank || bankName;
            accountName = matchedAccount.accountName || accountName;
            
            // Resolve the actual bank institution ID from the bank name
            const banks = await fetchSupportedBanks(context.verifiedUser.privyUserId);
            const matchedBankInst = banks.find(b => b.name?.toLowerCase() === matchedAccount.bank?.toLowerCase());
            if (matchedBankInst && (matchedBankInst.id || matchedBankInst.code)) {
              finalBankInstId = matchedBankInst.id || matchedBankInst.code;
            }
          }
        } catch (err) {
          console.warn("Failed to fetch saved accounts for UI enrichment:", err);
        }

        const order = await createOfframp(context.verifiedUser.privyUserId, {
          bank: finalBankInstId,
          accountNumber,
          currency: Currency.NGN,
          amount: usdcAmount,
          mint: USDC_MINT,
          chain: Chain.SOLANA,
          webhookURL: webhookUrl,
          businessUSDCFee: 0.5
        });

        let canExecuteInChat = false;
        let transactionId: string | undefined;
        const amountCheck = validateInChatAmount(usdcAmount);

        if (amountCheck.valid && context.verifiedUser) {
          const wallet = await lookupUserWallet(context.verifiedUser.privyUserId);
          if (wallet && wallet.walletAddress) {
            transactionId = generateTransactionId();
            canExecuteInChat = Boolean(wallet.walletId && wallet.walletId.length > 5);
            await storePendingTransaction({
              id: transactionId,
              type: "offramp",
              privyUserId: context.verifiedUser.privyUserId,
              walletAddress: wallet.walletAddress,
              walletId: wallet.walletId,
              usdcAmount,
              recipientAddress: order.address,
              createdAt: Date.now(),
              executed: false,
              offrampOrderId: order.id
            });
          }
        }

        const resObj = {
          status: "offramp_order_prepared",
          user: identifier || "Authenticated User",
          usdcAmount,
          rateNgnPerUsdc: rate,
          estimatedNairaReceived: `₦${estimatedNaira.toLocaleString()}`,
          payoutMethod: "Local Bank Transfer",
          bankId,
          accountNumber,
          bankName,
          accountName,
          platformFee: "0.50 USDC",
          orderId: order.id,
          canExecuteInChat,
          transactionId,
          instructions: canExecuteInChat
            ? `ACTION REQUIRED BY ASSISTANT: An interactive transaction confirmation widget has been rendered directly in the chat window. DO NOT redirect the user to an external link.`
            : `Please complete the withdrawal via the external checkout flow.`,
        };

        return {
          content: [{ type: "text", text: JSON.stringify(resObj, null, 2) }],
          structuredContent: resObj,
          _meta: { ui: { resourceUri: "ui://corre/transaction" } },
        };
      }

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
  {
    definition: {
      name: "get_supported_banks",
      description: "Get a list of supported Nigerian banks for Naira offramp withdrawals. Use this to help users select their bank when setting up a bank account for USDC withdrawal.",
      inputSchema: { type: "object", properties: {} },
      _meta: { securitySchemes: [{ type: "oauth2", scopes: [] }] }
    },
    handler: async (args, context) => {
      if (!context.verifiedUser) {
        return authRequiredResult("Please sign in to your Corre account.");
      }
      try {
        const banks = await fetchSupportedBanks(context.verifiedUser.privyUserId);
        const resObj = {
          status: "success",
          totalBanks: banks.length,
          banks: banks.map(b => ({ id: b.id || b.code, name: b.name })),
          instructions: "Select a bank from the list above, then use validate_bank_account with the bank ID and a 10-digit account number."
        };
        return {
          content: [{ type: "text", text: JSON.stringify(resObj, null, 2) }],
          structuredContent: resObj
        };
      } catch (err: any) {
        return { isError: true, content: [{ type: "text", text: err.message || "Failed to fetch supported banks" }] };
      }
    }
  },
  {
    definition: {
      name: "validate_bank_account",
      description: "Validate and resolve a Nigerian bank account number (NUBAN). Returns the verified account holder name. Use after getting the bank ID from get_supported_banks.",
      inputSchema: {
        type: "object",
        properties: {
          bankId: { type: "string" },
          accountNumber: { type: "string" }
        },
        required: ["bankId", "accountNumber"]
      },
      _meta: { securitySchemes: [{ type: "oauth2", scopes: [] }] }
    },
    handler: async (args, context) => {
      if (!context.verifiedUser) {
        return authRequiredResult("Please sign in to your Corre account.");
      }
      const { bankId, accountNumber } = args as { bankId: string; accountNumber: string };
      if (!accountNumber || accountNumber.length !== 10) {
        return { isError: true, content: [{ type: "text", text: "Invalid account number. Must be a 10-digit NUBAN." }] };
      }
      try {
        const result = await resolveBank(context.verifiedUser.privyUserId, bankId, accountNumber);
        const resObj = {
          status: "account_verified",
          bankId,
          accountNumber,
          accountName: result.accountName,
          resolvedBankId: result.bank?.id || bankId,
          instructions: "Account verified! You can now use prepare_offramp_usdc with these bank details, or save_bank_account to save for future use."
        };
        return {
          content: [{ type: "text", text: JSON.stringify(resObj, null, 2) }],
          structuredContent: resObj
        };
      } catch (err: any) {
        return { isError: true, content: [{ type: "text", text: "Failed to verify account: " + err.message }] };
      }
    }
  },
  {
    definition: {
      name: "get_saved_bank_accounts",
      description: "Get the user's saved Nigerian bank accounts for Naira offramp withdrawals.",
      inputSchema: { type: "object", properties: {} },
      _meta: { securitySchemes: [{ type: "oauth2", scopes: [] }] }
    },
    handler: async (args, context) => {
      if (!context.verifiedUser) {
        return authRequiredResult("Please sign in to your Corre account.");
      }
      try {
        const accounts = await fetchSavedBankAccounts(context.verifiedUser.privyUserId);
        const resObj = {
          status: "success",
          totalAccounts: accounts.length,
          accounts: accounts.map(a => ({ id: a.id, accountName: a.accountName, bank: a.bank, accountNumber: a.accountNumber })),
          instructions: accounts.length > 0 
            ? "Select a saved account to use for offramp, or add a new bank account." 
            : "No saved bank accounts found. YOU MUST NOW PROMPT THE USER to provide their Bank Name and 10-digit Account Number so you can save it for them. Once they provide it, use get_supported_banks and validate_bank_account to add it."
        };
        return {
          content: [{ type: "text", text: JSON.stringify(resObj, null, 2) }],
          structuredContent: resObj
        };
      } catch (err: any) {
        return { isError: true, content: [{ type: "text", text: err.message || "Failed to fetch saved bank accounts" }] };
      }
    }
  },
  {
    definition: {
      name: "save_bank_account",
      description: "Save a validated Nigerian bank account for future Naira offramp withdrawals.",
      inputSchema: {
        type: "object",
        properties: {
          bankId: { type: "string" },
          accountNumber: { type: "string" }
        },
        required: ["bankId", "accountNumber"]
      },
      _meta: { securitySchemes: [{ type: "oauth2", scopes: [] }] }
    },
    handler: async (args, context) => {
      if (!context.verifiedUser) {
        return authRequiredResult("Please sign in to your Corre account.");
      }
      const { bankId, accountNumber } = args as { bankId: string; accountNumber: string };
      if (!accountNumber || accountNumber.length !== 10) {
        return { isError: true, content: [{ type: "text", text: "Invalid account number. Must be a 10-digit NUBAN." }] };
      }
      try {
        await saveBank(context.verifiedUser.privyUserId, bankId, accountNumber);
        const resObj = {
          status: "account_saved",
          bankId,
          accountNumber,
          instructions: "Bank account saved successfully. You can now use prepare_offramp_usdc to withdraw USDC to this account."
        };
        return {
          content: [{ type: "text", text: JSON.stringify(resObj, null, 2) }],
          structuredContent: resObj
        };
      } catch (err: any) {
        return { isError: true, content: [{ type: "text", text: "Failed to save account: " + err.message }] };
      }
    }
  },
  {
    definition: {
      name: "get_offramp_order_status",
      description: "Check the status of a Naira offramp withdrawal order. Use this to track the progress of a USDC to Naira bank transfer.",
      inputSchema: {
        type: "object",
        properties: {
          orderId: { type: "string" }
        },
        required: ["orderId"]
      },
      _meta: { securitySchemes: [{ type: "oauth2", scopes: [] }] }
    },
    handler: async (args, context) => {
      if (!context.verifiedUser) {
        return authRequiredResult("Please sign in to your Corre account.");
      }
      const { orderId } = args as { orderId: string };
      try {
        const result = await pool.query(
          "SELECT id, status, amount_usdc, amount_fiat, rate, fee, updated_at FROM paj_offramp_orders WHERE id = $1",
          [orderId]
        );
        if (result.rows.length === 0) {
          return { isError: true, content: [{ type: "text", text: "Order not found" }] };
        }
        const resObj = {
          status: "success",
          order: result.rows[0]
        };
        return {
          content: [{ type: "text", text: JSON.stringify(resObj, null, 2) }],
          structuredContent: resObj
        };
      } catch (err: any) {
        return { isError: true, content: [{ type: "text", text: err.message || "Failed to fetch order status" }] };
      }
    }
  }
];
