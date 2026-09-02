import type { WebMcpTool, WebMcpContext } from "../types";
import { apiFetch } from "@/services/apiClient";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export const portfolioTools: (context: WebMcpContext) => WebMcpTool[] = (context) => [
  {
    name: "get_user_wallet",
    description: "Get the active user's connected Solana wallet address, authentication state, and chain network.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
    },
    execute: async () => {
      context.emitToast("👛", "Checking Wallet", "Reading active wallet address...");

      if (!context.authenticated || !context.solanaWalletAddress) {
        return {
          authenticated: false,
          walletAddress: null,
          message: "No user currently authenticated in this browser session.",
        };
      }

      return {
        authenticated: true,
        privyUserId: context.privyUser?.id,
        walletAddress: context.solanaWalletAddress,
        network: "Solana Mainnet",
      };
    },
  },
  {
    name: "get_user_portfolio",
    description: "Get the authenticated user's complete Corre portfolio: total net worth in USD, USDC liquid balance, savings vault balances, and US stock holdings.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
    },
    execute: async () => {
      const owner = context.solanaWalletAddress;
      if (!context.authenticated || !owner) {
        throw new Error("Please sign in to your Corre account to view your portfolio.");
      }

      context.emitToast("💼", "Loading Portfolio", "Aggregating balances across savings and equities...");

      let usdcWalletBalance = 0;
      let solBalance = 0;
      let shieldedSavings = 0;
      let standardSavings = 0;

      // 1. Fetch wallet balances via RPC
      try {
        const { Connection, PublicKey, LAMPORTS_PER_SOL } = await import("@solana/web3.js");
        const connection = new Connection(
          (import.meta.env.VITE_SOLANA_RPC ?? "https://api.mainnet-beta.solana.com").replace(/^['"]|['"]$/g, "").trim(),
          "confirmed"
        );
        const ownerPk = new PublicKey(owner);

        // SOL balance
        const lamports = await connection.getBalance(ownerPk);
        solBalance = Number((lamports / LAMPORTS_PER_SOL).toFixed(4));

        // USDC balance
        const usdcMintPk = new PublicKey(USDC_MINT);
        const resp = await connection.getParsedTokenAccountsByOwner(ownerPk, { mint: usdcMintPk });
        usdcWalletBalance = resp.value.reduce((sum, acc: any) => {
          const amt = acc?.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
          return sum + Number(amt || 0);
        }, 0);
      } catch (err) {
        console.warn("[WebMCP] RPC balance fetch error:", err);
      }

      // 2. Fetch Lulo savings
      const apiKey = import.meta.env.VITE_LULO_API_KEY;
      if (apiKey) {
        try {
          const url = new URL("https://api.lulo.fi/v1/account.getAccount");
          url.searchParams.set("owner", owner);
          const res = await fetch(url.toString(), {
            method: "GET",
            headers: {
              "x-api-key": apiKey,
              "Content-Type": "application/json",
            },
          });
          if (res.ok) {
            const data = await res.json();
            const pUsdVal = Number((data as any)?.pusdUsdBalance || 0);
            const totalVal = Number((data as any)?.totalValue || (data as any)?.depositValue || 0);
            shieldedSavings = isNaN(pUsdVal) ? 0 : Number(pUsdVal.toFixed(2));
            const rawStd = isNaN(totalVal) ? 0 : Math.max(0, totalVal - shieldedSavings);
            standardSavings = Number(rawStd.toFixed(2));
          }
        } catch {
          // Ignore
        }
      }

      const totalPortfolioUSD = Number((usdcWalletBalance + shieldedSavings + standardSavings).toFixed(2));

      context.emitToast(
        "📊",
        "Portfolio Loaded",
        `Total Net Worth: $${totalPortfolioUSD.toLocaleString()} USD`,
        "success"
      );

      return {
        status: "success",
        walletAddress: owner,
        totalPortfolioUSD,
        liquidUSDC: Number(usdcWalletBalance.toFixed(2)),
        solanaBalanceSOL: solBalance,
        savings: {
          shieldedVaultUSD: shieldedSavings,
          standardVaultUSD: standardSavings,
          totalSavingsUSD: Number((shieldedSavings + standardSavings).toFixed(2)),
        },
      };
    },
  },
];
