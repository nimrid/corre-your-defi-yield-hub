import type { MCPTool, MCPContext } from "../types.js";
import { authRequiredResult } from "../auth.js";
import { privy } from "../auth.js";
import { pool } from "../../db.js";
import { resolveUserId } from "../../lib/dbHelpers.js";
import { US_STOCK_TOKENS, findStockToken } from "../../config/usStockTokens.js";
import { lookupUserWallet } from "../../services/privyWalletService.js";
import { fetchLiveSolanaBalances } from "../helpers/solana.js";
import { fetchLiveLuloBalance } from "../helpers/lulo.js";

// Note: fetchLiveLuloYields might be needed in get_user_portfolio
import { fetchLiveLuloYields } from "../helpers/lulo.js";

export const userTools: MCPTool[] = [
  {
    definition: {
      name: "create_corre_user",
      description: "Create a new Corre account & Solana wallet for a new user directly via email",
      inputSchema: {
        type: "object",
        properties: {
          email: { type: "string", description: "User email address for account creation" },
        },
        required: ["email"],
      },
    },
    handler: async (args, context) => {
      const email = (args?.email as string)?.trim()?.toLowerCase();
      if (!email) throw new Error("Email is required");

      // Basic email format validation
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("Invalid email format");
      }

      let privyUserId = `usr_${Date.now()}`;
      let walletAddress = "";

      if (privy) {
        try {
          const importedUser = await privy.importUser({
            linkedAccounts: [{ type: "email", address: email }],
            createSolanaWallet: true,
          });
          privyUserId = importedUser.id;

          const solWallet = importedUser.linkedAccounts.find(
            (acc) => acc.type === "wallet" && (acc as any).chainType === "solana"
          );
          walletAddress = solWallet ? (solWallet as any).address : "";
        } catch (err: any) {
          if (err?.status === 409 || err?.message?.includes("already exists") || String(err).includes("409")) {
            const existingUser = await privy.getUserByEmail(email).catch(() => null);
            if (existingUser) {
              privyUserId = existingUser.id;
              let solWallet = existingUser.linkedAccounts.find(
                (acc) => acc.type === "wallet" && (acc as any).chainType === "solana"
              );

              if (!solWallet) {
                try {
                  const updatedUser = await privy.createWallets({
                    userId: existingUser.id,
                    createSolanaWallet: true,
                  });
                  solWallet = updatedUser.linkedAccounts.find(
                    (acc) => acc.type === "wallet" && (acc as any).chainType === "solana"
                  );
                } catch (wErr) {
                  console.warn("[MCP] Wallet creation warning:", wErr);
                }
              }

              walletAddress = solWallet ? (solWallet as any).address : "";
            }
          } else {
            console.warn("[MCP] Privy user creation warning:", err);
          }
        }
      }

      const userRes = await pool.query(
        `INSERT INTO users (privy_user_id, email, created_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (privy_user_id) 
         DO UPDATE SET email = COALESCE(EXCLUDED.email, users.email)
         RETURNING id, privy_user_id, email`,
        [privyUserId, email]
      );

      const dbUser = userRes.rows[0];

      if (walletAddress && dbUser?.id) {
        await pool.query(
          `INSERT INTO wallets (user_id, chain_type, address, is_linked, created_at)
           VALUES ($1, 'solana', $2, TRUE, NOW())
           ON CONFLICT DO NOTHING`,
          [dbUser.id, walletAddress]
        );
      }

      const qrCodeUrl = walletAddress ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(walletAddress)}` : "";

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                status: "success",
                message: `Corre account successfully created for ${email}!`,
                privyUserId: dbUser?.privy_user_id || privyUserId,
                walletAddress: walletAddress || "Solana wallet ready upon app login",
                qrCodeUrl,
                markdownQRCode: qrCodeUrl ? `![Wallet QR Code](${qrCodeUrl})` : undefined,
                loginNote: `When you visit ${context.getAppBaseUrl()}, log in with ${email} to access your wallet and portfolio.`,
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
      name: "get_user_portfolio",
      description: "Get user's stock holdings, savings vault balance, wallet address, and recent activity in Corre",
      inputSchema: {
        type: "object",
        properties: {
          identifier: { type: "string", description: "User email address or Privy User ID (ignored if authenticated via session)" },
        },
      },
    },
    handler: async (args, context) => {
      let identifier: string | undefined;

      if (context.verifiedUser) {
        identifier = context.verifiedUser.email || context.verifiedUser.privyUserId;
      } else {
        identifier = args.identifier as string | undefined;
      }

      if (!identifier) {
        if (process.env.ENFORCE_MCP_AUTH === "true") {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  status: "auth_required",
                  securityMessage: "🔒 For privacy and security, balance details require user authentication. Log into your Corre account to view your balance securely.",
                  loginUrl: `${context.getAppBaseUrl()}/login`,
                }),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "identifier_required",
                message: "Please provide your registered email address or Privy User ID so I can fetch your Corre portfolio balance.",
              }),
            },
          ],
        };
      }

      let userId: number | null = null;
      let privyUserId = identifier || "";

      if (identifier && identifier.includes("@")) {
        const userRes = await pool.query(`SELECT id, privy_user_id FROM users WHERE email = $1`, [identifier.toLowerCase()]);
        if (userRes.rows.length > 0) {
          userId = userRes.rows[0].id;
          privyUserId = userRes.rows[0].privy_user_id;
        }
      } else if (identifier) {
        userId = await resolveUserId(identifier);
      }

      if (userId === null) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "user_not_found",
                message: `No Corre account found for '${identifier}'. Use the create_corre_user tool to set up an account instantly!`,
              }),
            },
          ],
        };
      }

      // 1. Resolve wallet address
      let walletAddress = "";
      if (userId) {
        const walletRes = await pool.query(
          `SELECT address FROM wallets WHERE user_id = $1 AND chain_type = 'solana' LIMIT 1`,
          [userId]
        );
        walletAddress = walletRes.rows[0]?.address || "";
      }

      if (!walletAddress && privy && privyUserId) {
        const pUser = await privy.getUser(privyUserId).catch(() => null);
        const solWallet = pUser?.linkedAccounts.find((a: any) => a.type === "wallet" && (a as any).chainType === "solana");
        walletAddress = (solWallet as any)?.address || "";
      }

      // 2. Fetch all portfolio data concurrently (DB + Solana RPC + Lulo API balances & APY)
      const [holdingsRes, savingsRes, txRes, liveSolanaBalances, liveLuloBalances, liveLuloYields] = await Promise.all([
        pool.query(
          `SELECT stock_mint AS "stockMint", GREATEST(shares, 0) AS shares 
           FROM stock_holdings_summary WHERE user_id = $1 AND shares > 0`,
          [userId]
        ),
        pool.query(
          `SELECT vault_type AS "vaultType", 
                  SUM(CASE WHEN direction = 'deposit' THEN COALESCE(usdc_amount::numeric, 0) ELSE -COALESCE(usdc_amount::numeric, 0) END) AS "balanceUsdc"
           FROM savings_activity WHERE user_id = $1 GROUP BY vault_type`,
          [userId]
        ),
        pool.query(
          `SELECT asset_symbol AS "assetSymbol", amount, direction, created_at AS "createdAt"
           FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5`,
          [userId]
        ),
        fetchLiveSolanaBalances(walletAddress),
        fetchLiveLuloBalance(walletAddress),
        fetchLiveLuloYields(),
      ]);

      // 3. Process savings vault balances (merge Lulo API with DB)
      let dbShielded = 0;
      let dbStandard = 0;
      savingsRes.rows.forEach((row: any) => {
        const val = Number(row.balanceUsdc || 0);
        if (row.vaultType === "shielded" || row.vaultType === "protected") {
          dbShielded = val;
        } else {
          dbStandard = val;
        }
      });

      const finalShieldedVaultUsdc = liveLuloBalances.shieldedBalance > 0 ? liveLuloBalances.shieldedBalance : Math.max(0, dbShielded);
      const finalStandardVaultUsdc = liveLuloBalances.standardBalance > 0 ? liveLuloBalances.standardBalance : Math.max(0, dbStandard);
      const totalSavingsUsdc = Number((finalShieldedVaultUsdc + finalStandardVaultUsdc).toFixed(2));

      // 4. Enrich stock holdings with human-readable ticker symbol & name
      const enrichedStockHoldings = holdingsRes.rows.map((row: any) => {
        const stockConfig = findStockToken(row.stockMint);
        return {
          symbol: stockConfig?.symbol || "STOCK",
          name: stockConfig?.name || "Tokenized US Stock",
          shares: Number(row.shares),
          stockMint: row.stockMint,
        };
      });

      // 5. Construct QR Code & Summary Text
      const qrCodeUrl = walletAddress ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(walletAddress)}` : "";

      const formattedWalletUsdc = `$${liveSolanaBalances.usdcBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })} USDC`;
      const formattedWalletSol = `${liveSolanaBalances.solBalance} SOL`;
      const formattedShieldedVault = `$${finalShieldedVaultUsdc.toLocaleString("en-US", { minimumFractionDigits: 2 })} USDC`;
      const formattedStandardVault = `$${finalStandardVaultUsdc.toLocaleString("en-US", { minimumFractionDigits: 2 })} USDC`;

      const stockSummaryStr = enrichedStockHoldings.length > 0
        ? enrichedStockHoldings.map((s: any) => `${s.name} (${s.symbol}): ${s.shares} shares`).join(", ")
        : "No active stock holdings";

      const portfolioSummaryText = `Solana Wallet: ${formattedWalletUsdc} (${formattedWalletSol}) | Shielded Savings Vault (~${liveLuloYields.shieldedVaultAPY} APY): ${formattedShieldedVault} | Standard Savings Vault (~${liveLuloYields.standardVaultAPY} APY): ${formattedStandardVault} | US Stocks: ${stockSummaryStr}`;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                status: "success",
                user: identifier,
                privyUserId,
                authenticated: Boolean(context.verifiedUser),
                authInstruction: context.verifiedUser 
                  ? "Session authenticated via Privy token."
                  : `To authenticate your Corre session or manage your account, log in at ${context.getAppBaseUrl()}/login`,
                walletAddress: walletAddress || "Solana wallet ready upon app login",
                qrCodeUrl,
                markdownQRCode: qrCodeUrl ? `![Wallet QR Code](${qrCodeUrl})` : undefined,
                walletBalances: {
                  usdcBalance: liveSolanaBalances.usdcBalance,
                  solBalance: liveSolanaBalances.solBalance,
                  formattedUsdc: formattedWalletUsdc,
                  formattedSol: formattedWalletSol,
                },
                savingsVaults: {
                  shieldedVault: {
                    vaultType: "Shielded Savings Vault (Protected Yield)",
                    balanceUsdc: finalShieldedVaultUsdc,
                    formattedBalance: formattedShieldedVault,
                    estimatedAPY: `${liveLuloYields.shieldedVaultAPY} APY`,
                    interestEarnedUsdc: liveLuloBalances.totalInterestEarned,
                  },
                  standardVault: {
                    vaultType: "Standard Savings Vault",
                    balanceUsdc: finalStandardVaultUsdc,
                    formattedBalance: formattedStandardVault,
                    estimatedAPY: `${liveLuloYields.standardVaultAPY} APY`,
                  },
                  totalSavingsUsdc,
                },
                stockHoldings: enrichedStockHoldings,
                availableInvestableStocksNote: "To search or list all investable US stocks supported on Corre (AAPL, TSLA, NVDA, GOOGL, AMZN, META, COIN, etc.), use the list_available_stocks or search_tokenized_stocks tool.",
                recentTransactions: txRes.rows,
                portfolioSummary: portfolioSummaryText,
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
      name: "get_user_wallet",
      description: "Get user's Solana wallet address and QR code image URL for funding or depositing USDC/SOL into Corre",
      inputSchema: {
        type: "object",
        properties: {
          identifier: { type: "string", description: "User email address or Privy User ID (optional if authenticated)" },
        },
      },
    },
    handler: async (args, context) => {
      // Wallet reads contain private wallet addresses. Require authentication.
      if (!context.verifiedUser) {
        return authRequiredResult("Please sign in to your Corre account to view your wallet address.");
      }

      const identifier = context.verifiedUser.email || context.verifiedUser.privyUserId;
      let userId: number | null = null;
      let privyUserId = context.verifiedUser.privyUserId;

      if (identifier && identifier.includes("@")) {
        const userRes = await pool.query(`SELECT id, privy_user_id FROM users WHERE email = $1`, [identifier.toLowerCase()]);
        if (userRes.rows.length > 0) {
          userId = userRes.rows[0].id;
          privyUserId = userRes.rows[0].privy_user_id;
        }
      } else {
        userId = await resolveUserId(context.verifiedUser.privyUserId);
      }

      let walletAddress = "";
      if (userId) {
        const walletRes = await pool.query(
          `SELECT address FROM wallets WHERE user_id = $1 AND chain_type = 'solana' LIMIT 1`,
          [userId]
        );
        walletAddress = walletRes.rows[0]?.address || "";
      }

      if (!walletAddress && privy && privyUserId) {
        const pUser = await privy.getUser(privyUserId).catch(() => null);
        const solWallet = pUser?.linkedAccounts.find((a: any) => a.type === "wallet" && (a as any).chainType === "solana");
        walletAddress = (solWallet as any)?.address || "";
      }

      if (!walletAddress) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "wallet_not_found",
                message: `No Solana wallet address found linked to this account yet. Log into ${context.getAppBaseUrl()} to initialize your wallet.`,
              }),
            },
          ],
        };
      }

      const liveSolanaBalances = await fetchLiveSolanaBalances(walletAddress);
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(walletAddress)}`;

      const formattedUsdc = `$${liveSolanaBalances.usdcBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })} USDC`;
      const formattedSol = `${liveSolanaBalances.solBalance} SOL`;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                status: "success",
                user: identifier,
                chain: "Solana",
                walletAddress,
                usdcBalance: liveSolanaBalances.usdcBalance,
                solBalance: liveSolanaBalances.solBalance,
                formattedWalletBalance: `${formattedUsdc} (${formattedSol})`,
                qrCodeUrl,
                markdownQRCode: `![Wallet QR Code](${qrCodeUrl})`,
                instructions: `Send USDC or SOL to your Solana address above or scan the QR code to fund your Corre account. Current balance: ${formattedUsdc} (${formattedSol}).`,
                depositOptionsUrl: `${context.getAppBaseUrl()}/buy-usdc`,
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
      name: "get_user_referral_info",
      description: "Get user's custom referral code, shareable invite link (https://corre.bond/login?ref=CODE), total earned points, and referred friends list",
      inputSchema: {
        type: "object",
        properties: {
          identifier: { type: "string", description: "User email address or Privy User ID" },
        },
      },
    },
    handler: async (args, context) => {
      // 🔒 Reads a user's private referral points/code, so require a verified
      // session and derive identity from it — never from args.identifier.
      if (!context.verifiedUser) {
        return authRequiredResult("Please sign in to your Corre account to view your referral information.");
      }
      const identifier = context.verifiedUser.email || context.verifiedUser.privyUserId;

      let userId: number | null = null;
      let privyUserId = context.verifiedUser.privyUserId;

      if (identifier && identifier.includes("@")) {
        const userRes = await pool.query(`SELECT id, privy_user_id FROM users WHERE email = $1`, [identifier.toLowerCase()]);
        if (userRes.rows.length > 0) {
          userId = userRes.rows[0].id;
          privyUserId = userRes.rows[0].privy_user_id;
        }
      } else if (identifier) {
        userId = await resolveUserId(identifier);
      }

      // Generate stable referral code based on user
      // Generate a more unique referral code using a hash of the user ID
      const rawId = privyUserId || "CORRE";
      let hash = 0;
      for (let i = 0; i < rawId.length; i++) {
        hash = ((hash << 5) - hash + rawId.charCodeAt(i)) | 0;
      }
      const refCode = Math.abs(hash).toString(36).toUpperCase().slice(0, 6).padEnd(6, "X");
      const inviteUrl = `${context.getAppBaseUrl()}/login?ref=${refCode}`;

      let totalPoints = 0;
      let referredFrens: any[] = [];

      if (userId) {
        try {
          const refRes = await pool.query(
            `SELECT referral_code, total_points FROM user_referrals WHERE user_id = $1`,
            [userId]
          );
          if (refRes.rows.length > 0) {
            totalPoints = refRes.rows[0].total_points || 0;
          }
        } catch (err) {
          console.warn("[MCP] Referral lookup error:", err);
        }
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                status: "success",
                user: identifier,
                referralCode: refCode,
                shareableInviteLink: inviteUrl,
                totalEarnedPoints: totalPoints,
                referredFriendsCount: referredFrens.length,
                rewardRules: [
                  "+100 points when a friend signs up",
                  "+500 points when a friend deposits into Savings Vault",
                  "+300 points when a friend buys US stocks",
                ],
                instructions: `Share your invite link ${inviteUrl} with friends to earn reward points on Corre!`,
              },
              null,
              2
            ),
          },
        ],
      };
    },
  },
];
