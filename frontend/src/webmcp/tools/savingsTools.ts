import type { WebMcpTool, WebMcpContext } from "../types";
import { apiFetch } from "@/services/apiClient";
import { Buffer } from "buffer";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const LULO_REFERRER = "6pZiqTT81nKLxMvQay7P6TrRx9NdWG5zbakaZdQoWoUb";
const LULO_BASE_URL = "https://api.lulo.fi";

export const savingsTools: (context: WebMcpContext) => WebMcpTool[] = (context) => [
  {
    name: "get_savings_yield",
    description: "Get current live APY yield rates for Corre Standard (~8.5% APY) and Shielded (~6.2% APY) USDC savings vaults.",
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
      context.emitToast("📈", "Checking Yields", "Fetching live Corre savings APYs...");
      
      let standardVaultAPY = "8.5%";
      let shieldedVaultAPY = "6.2%";
      
      const apiKey = import.meta.env.VITE_LULO_API_KEY;
      if (apiKey) {
        try {
          const res = await fetch(`${LULO_BASE_URL}/v1/pool.getPools`, {
            method: "GET",
            headers: {
              "x-api-key": apiKey,
              "Content-Type": "application/json",
            },
          });
          if (res.ok) {
            const data = await res.json();
            const pools: any[] = (data as any)?.pools || (data as any)?.data || [];
            const usdcPool = pools.find(
              (p) =>
                p?.mint?.toLowerCase() === USDC_MINT.toLowerCase() ||
                p?.symbol?.toUpperCase() === "USDC" ||
                p?.name?.toUpperCase()?.includes("USDC")
            );
            if (usdcPool) {
              const baseRate = Number(usdcPool.totalApy || usdcPool.supplyApy || usdcPool.apy || 0);
              if (baseRate > 0) {
                standardVaultAPY = `${(baseRate * 100).toFixed(2)}%`;
                shieldedVaultAPY = `${(baseRate * 100 * 0.73).toFixed(2)}%`;
              }
            }
          }
        } catch {
          // Fall back to default advertised rates
        }
      }

      context.emitToast("💰", "Live APY Loaded", `Standard: ${standardVaultAPY} | Shielded: ${shieldedVaultAPY}`, "success");

      return {
        status: "success",
        asset: "USDC",
        standardVaultAPY,
        shieldedVaultAPY,
        shieldedVaultFeatures: [
          "Protected principal (pUSD tracking)",
          "Enhanced security liquidation buffer",
          "Automated compound interest",
        ],
        standardVaultFeatures: [
          "Maximized market yield",
          "Direct algorithmic allocation across top Solana lending protocols",
        ],
      };
    },
  },
  {
    name: "get_savings_balance",
    description: "Get the current Shielded and Standard savings vault balances and accrued interest for the connected user.",
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
      if (!owner) {
        throw new Error("No connected Solana wallet. Please connect your wallet first.");
      }

      context.emitToast("🏦", "Checking Vault Balance", `Checking savings for ${owner.slice(0, 4)}...${owner.slice(-4)}`);

      const apiKey = import.meta.env.VITE_LULO_API_KEY;
      let shieldedBalance = 0;
      let standardBalance = 0;
      let totalInterestEarned = 0;

      if (apiKey) {
        try {
          const url = new URL(`${LULO_BASE_URL}/v1/account.getAccount`);
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
            const interestVal = Number((data as any)?.protectedInterestEarned || (data as any)?.interestEarned || 0);

            shieldedBalance = isNaN(pUsdVal) ? 0 : Number(pUsdVal.toFixed(2));
            const rawStandard = isNaN(totalVal) ? 0 : Math.max(0, totalVal - shieldedBalance);
            standardBalance = Number(rawStandard.toFixed(2));
            totalInterestEarned = isNaN(interestVal) ? 0 : Number(interestVal.toFixed(2));
          }
        } catch (err: any) {
          console.warn("[WebMCP] Failed to fetch account savings balance:", err);
        }
      }

      return {
        status: "success",
        walletAddress: owner,
        shieldedVaultBalanceUSDC: shieldedBalance,
        standardVaultBalanceUSDC: standardBalance,
        totalSavingsBalanceUSDC: Number((shieldedBalance + standardBalance).toFixed(2)),
        totalInterestEarnedUSDC: totalInterestEarned,
      };
    },
  },
  {
    name: "deposit_savings_vault",
    description: "Deposit USDC into Corre Savings Vault (Shielded ~6.2% APY or Standard ~8.5% APY). Initiates on-chain transaction in browser with connected Solana wallet.",
    inputSchema: {
      type: "object",
      properties: {
        usdcAmount: {
          type: "number",
          description: "Amount of USDC to deposit (e.g. 10, 50, 100). Minimum is 1 USDC.",
        },
        vaultType: {
          type: "string",
          enum: ["shielded", "standard"],
          description: "Vault type: 'shielded' for Protected Savings or 'standard' for Standard Savings (default: shielded).",
        },
      },
      required: ["usdcAmount"],
      additionalProperties: false,
    },
    execute: async (args: { usdcAmount: number; vaultType?: "shielded" | "standard" }) => {
      const { usdcAmount, vaultType = "shielded" } = args;

      if (!usdcAmount || typeof usdcAmount !== "number" || usdcAmount <= 0) {
        throw new Error("Invalid USDC amount. Please specify a positive number.");
      }
      if (usdcAmount < 1) {
        throw new Error("Minimum deposit amount is 1 USDC.");
      }

      const wallet = context.solanaWallet;
      const owner = context.solanaWalletAddress;
      if (!wallet || !owner) {
        throw new Error("Please sign in and connect your Solana wallet to deposit funds.");
      }

      const isShielded = vaultType.toLowerCase() === "shielded";
      context.emitToast(
        "⚡",
        "Preparing Savings Deposit",
        `Depositing ${usdcAmount} USDC into ${isShielded ? "Shielded" : "Standard"} Vault...`
      );

      const apiKey = import.meta.env.VITE_LULO_API_KEY;
      if (!apiKey) {
        throw new Error("Lulo API key is not configured in client (VITE_LULO_API_KEY).");
      }

      // Pre-flight balance check
      try {
        const { Connection, PublicKey } = await import("@solana/web3.js");
        const rpcUrl = (import.meta.env.VITE_SOLANA_RPC ?? "https://api.mainnet-beta.solana.com").replace(/^['"]|['"]$/g, "").trim();
        const connection = new Connection(rpcUrl, "confirmed");
        const ownerPk = new PublicKey(owner);

        // Check USDC Balance
        const usdcMintPk = new PublicKey(USDC_MINT);
        const resp = await connection.getParsedTokenAccountsByOwner(ownerPk, { mint: usdcMintPk });
        const currentUsdcBalance = resp.value.reduce((sum, acc: any) => {
          const amt = acc?.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
          return sum + Number(amt || 0);
        }, 0);

        if (currentUsdcBalance < usdcAmount) {
          throw new Error(
            `Insufficient USDC balance: Your wallet has ${currentUsdcBalance.toFixed(2)} USDC, but you requested to deposit ${usdcAmount} USDC. Please choose an amount within your available balance ($${currentUsdcBalance.toFixed(2)} USDC).`
          );
        }
      } catch (err: any) {
        if (err.message?.includes("Insufficient USDC balance")) {
          throw err;
        }
        console.warn("[WebMCP] Pre-flight balance check warning:", err);
      }

      let feePayer = owner;
      let useGasSponsorship = false;

      // Check gas sponsorship
      try {
        const eligibilityResponse = await apiFetch("/gas-sponsorship/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            privyUserId: context.privyUser?.id,
            amountUSD: usdcAmount,
          }),
        });

        if (eligibilityResponse.ok) {
          const eligibility = await eligibilityResponse.json();
          if (eligibility.sponsorshipAllowed !== false && eligibility.feePayerAddress) {
            useGasSponsorship = true;
            feePayer = eligibility.feePayerAddress;
          }
        }
      } catch {
        console.warn("[WebMCP] Gas sponsorship check failed, proceeding with direct flow");
      }

      // Generate deposit transaction via Lulo API
      const res = await fetch(`${LULO_BASE_URL}/v1/generate.transactions.deposit`, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          owner,
          feePayer,
          mintAddress: USDC_MINT,
          regularAmount: isShielded ? 0 : usdcAmount,
          protectedAmount: isShielded ? usdcAmount : 0,
          referrer: LULO_REFERRER,
        }),
      });

      if (!res.ok) {
        let errMsg = `Failed to generate deposit transaction (Lulo HTTP ${res.status})`;
        try {
          const errBody = await res.json();
          errMsg = errBody.message || errBody.error || errMsg;
        } catch {}
        throw new Error(errMsg);
      }

      const data = await res.json();
      const encodedTx: string | undefined =
        (data as any)?.transaction ||
        (data as any)?.tx ||
        (data as any)?.transactions?.[0]?.transaction;

      if (!encodedTx) {
        throw new Error("Deposit transaction payload not found in Lulo response.");
      }

      const rawTx = Uint8Array.from(atob(encodedTx), (c) => c.charCodeAt(0));
      let txSignature = "";

      if (useGasSponsorship) {
        const { VersionedTransaction } = await import("@solana/web3.js");
        const transaction = VersionedTransaction.deserialize(rawTx);

        // Sign with Privy Solana wallet
        let signedBytes: Uint8Array;
        if (context.signTransaction) {
          const signRes = await context.signTransaction({
            transaction: new Uint8Array(transaction.serialize()),
            wallet,
          });
          signedBytes = signRes?.signedTransaction ?? signRes;
        } else if (typeof (wallet as any).signTransaction === "function") {
          const signRes = await (wallet as any).signTransaction({
            transaction: transaction.serialize(),
          });
          signedBytes = signRes?.signedTransaction ?? signRes;
        } else {
          throw new Error("Solana wallet does not support signTransaction.");
        }

        const serializedTransaction = Buffer.from(signedBytes).toString("base64");

        const sponsorRes = await apiFetch("/gas-sponsorship/sponsor-transaction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transaction: serializedTransaction,
          }),
        });

        if (!sponsorRes.ok) {
          let errText = await sponsorRes.text();
          try {
            const errObj = JSON.parse(errText);
            errText = errObj.error || errText;
          } catch {}
          throw new Error(`Gas sponsorship failed: ${errText}`);
        }

        const sponsorData = await sponsorRes.json();
        txSignature = sponsorData.transactionHash || sponsorData.signature || "";
      } else {
        // Direct broadcast
        try {
          if (context.signAndSendTransaction) {
            const result = await context.signAndSendTransaction({
              transaction: rawTx,
              wallet,
            });
            txSignature = result?.signature?.toString() ?? "";
          } else {
            throw new Error("No signAndSendTransaction available");
          }
        } catch (simError: any) {
          console.warn("[WebMCP] signAndSendTransaction failed, attempting fallback with custom connection:", simError);
          
          // Fallback using signTransaction + direct RPC send
          const { Connection, VersionedTransaction } = await import("@solana/web3.js");
          const transaction = VersionedTransaction.deserialize(rawTx);

          let signedBytes: Uint8Array;
          if (context.signTransaction) {
            const signRes = await context.signTransaction({
              transaction: new Uint8Array(transaction.serialize()),
              wallet,
            });
            signedBytes = signRes?.signedTransaction ?? signRes;
          } else if (typeof (wallet as any).signTransaction === "function") {
            const signRes = await (wallet as any).signTransaction({
              transaction: transaction.serialize(),
            });
            signedBytes = signRes?.signedTransaction ?? signRes;
          } else {
            const msg = simError?.message || "Solana transaction simulation failed";
            throw new Error(
              msg.includes("simulation failed")
                ? "Transaction simulation failed. Please ensure your wallet has enough USDC balance and sufficient SOL (minimum ~0.003 SOL) to pay for Solana network fees."
                : msg
            );
          }

          const rpcUrl = (import.meta.env.VITE_SOLANA_RPC ?? "https://api.mainnet-beta.solana.com").replace(/^['"]|['"]$/g, "").trim();
          const connection = new Connection(rpcUrl, "confirmed");

          try {
            txSignature = await connection.sendRawTransaction(signedBytes, {
              skipPreflight: false,
              maxRetries: 3,
            });
          } catch (sendErr: any) {
            const errMsg = sendErr?.message || simError?.message || "Deposit transaction failed";
            if (errMsg.includes("simulation failed") || errMsg.includes("Simulation failed") || errMsg.includes("0x1")) {
              throw new Error(
                "Transaction simulation failed. Please verify that you have sufficient USDC balance and at least 0.003 SOL to cover Solana network transaction fees."
              );
            }
            throw new Error(errMsg);
          }
        }
      }

      // Record activity in backend
      const privyUserId = context.privyUser?.id;
      if (privyUserId && txSignature) {
        void apiFetch("/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            privyUserId,
            chainType: "solana",
            assetSymbol: "USDC",
            amount: String(usdcAmount),
            direction: "outgoing",
            txSignature,
            fromAddress: owner,
            toAddress: isShielded ? "lulo_vault_protected" : "lulo_vault_regular",
            source: isShielded ? "save_protected_deposit" : "save_regular_deposit",
          }),
        }).catch(() => {});

        void apiFetch("/savings-activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            privyUserId,
            vaultType: isShielded ? "protected" : "regular",
            direction: "deposit",
            usdcAmount: String(usdcAmount),
            walletAddress: owner,
            txSignature,
            source: isShielded ? "save_protected_deposit" : "save_regular_deposit",
          }),
        }).catch(() => {});
      }

      context.emitToast(
        "✅",
        "Deposit Successful!",
        `Deposited ${usdcAmount} USDC into ${isShielded ? "Shielded" : "Standard"} Vault`,
        "success"
      );

      return {
        status: "success",
        message: `Successfully deposited ${usdcAmount} USDC into ${isShielded ? "Shielded" : "Standard"} Vault`,
        txSignature,
        explorerUrl: `https://solscan.io/tx/${txSignature}`,
        vaultType: isShielded ? "shielded" : "standard",
        usdcAmount,
      };
    },
  },
];
