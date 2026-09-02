import type { WebMcpTool, WebMcpContext } from "../types";
import { apiFetch } from "@/services/apiClient";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export const transferTools: (context: WebMcpContext) => WebMcpTool[] = (context) => [
  {
    name: "send_to_solana_wallet",
    description: "Send and transfer USDC or SOL to any destination Solana wallet address with connected wallet signing and optional gas sponsorship.",
    inputSchema: {
      type: "object",
      properties: {
        recipientAddress: {
          type: "string",
          description: "Destination Solana wallet address (base58 public key, 32-44 characters).",
        },
        amount: {
          type: "number",
          description: "Amount to transfer (e.g. 5, 10, 25).",
        },
        asset: {
          type: "string",
          enum: ["USDC", "SOL"],
          description: "Asset to send: 'USDC' or 'SOL' (default: 'USDC').",
        },
      },
      required: ["recipientAddress", "amount"],
      additionalProperties: false,
    },
    execute: async (args: { recipientAddress: string; amount: number; asset?: "USDC" | "SOL" }) => {
      const { recipientAddress, amount, asset = "USDC" } = args;

      if (!recipientAddress || typeof recipientAddress !== "string") {
        throw new Error("Please specify a recipient Solana wallet address.");
      }

      if (!amount || typeof amount !== "number" || amount <= 0) {
        throw new Error("Please specify a valid transfer amount greater than 0.");
      }

      const wallet = context.solanaWallet;
      const owner = context.solanaWalletAddress;

      if (!context.authenticated || !wallet || !owner) {
        throw new Error("Please sign in and connect your Solana wallet to send transfers.");
      }

      const {
        Connection,
        PublicKey,
        Transaction,
        VersionedTransaction,
        TransactionMessage,
        SystemProgram,
        LAMPORTS_PER_SOL,
      } = await import("@solana/web3.js");

      let toPubkey: any;
      try {
        toPubkey = new PublicKey(recipientAddress.trim());
      } catch {
        throw new Error(`Invalid recipient Solana address: "${recipientAddress}". Must be a valid base58 public key.`);
      }

      const fromPubkey = new PublicKey(owner);

      if (toPubkey.equals(fromPubkey)) {
        throw new Error("Recipient address cannot be your own wallet address.");
      }

      context.emitToast(
        "💸",
        "Preparing Transfer",
        `Sending ${amount} ${asset} to ${recipientAddress.slice(0, 4)}...${recipientAddress.slice(-4)}`
      );

      const rpcUrl = (import.meta.env.VITE_SOLANA_RPC ?? "https://api.mainnet-beta.solana.com").replace(/^['"]|['"]$/g, "").trim();
      const connection = new Connection(rpcUrl, "confirmed");

      // Pre-flight balance checks
      if (asset === "SOL") {
        const lamports = await connection.getBalance(fromPubkey);
        const solBalance = lamports / LAMPORTS_PER_SOL;
        if (solBalance < amount + 0.00001) {
          throw new Error(
            `Insufficient SOL balance: Your wallet has ${solBalance.toFixed(4)} SOL, but you requested to send ${amount} SOL.`
          );
        }
      } else {
        // USDC balance check
        const usdcMintPk = new PublicKey(USDC_MINT);
        const resp = await connection.getParsedTokenAccountsByOwner(fromPubkey, { mint: usdcMintPk });
        const currentUsdcBalance = resp.value.reduce((sum, acc: any) => {
          const amt = acc?.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
          return sum + Number(amt || 0);
        }, 0);

        if (currentUsdcBalance < amount) {
          throw new Error(
            `Insufficient USDC balance: Your wallet has ${currentUsdcBalance.toFixed(2)} USDC, but you requested to send ${amount} USDC.`
          );
        }
      }

      // Check gas sponsorship eligibility
      let useGasSponsorship = false;
      let feePayerAddress = "";

      try {
        const eligibilityResponse = await apiFetch("/gas-sponsorship/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            privyUserId: context.privyUser?.id,
            amountUSD: amount,
          }),
        });

        if (eligibilityResponse.ok) {
          const eligibility = await eligibilityResponse.json();
          if (eligibility.sponsorshipAllowed !== false && eligibility.feePayerAddress) {
            useGasSponsorship = true;
            feePayerAddress = eligibility.feePayerAddress;
          }
        }
      } catch (err) {
        console.warn("[WebMCP] Gas sponsorship check skipped:", err);
      }

      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      const instructions: any[] = [];
      const feePayer = useGasSponsorship ? new PublicKey(feePayerAddress) : fromPubkey;

      if (asset === "SOL") {
        const rawAmount = Math.floor(amount * LAMPORTS_PER_SOL);
        instructions.push(
          SystemProgram.transfer({
            fromPubkey,
            toPubkey,
            lamports: rawAmount,
          })
        );
      } else {
        const {
          getAssociatedTokenAddress,
          createTransferInstruction,
          createAssociatedTokenAccountInstruction,
        } = await import("@solana/spl-token");

        const usdcMint = new PublicKey(USDC_MINT);
        const fromTokenAccount = await getAssociatedTokenAddress(usdcMint, fromPubkey);
        const toTokenAccount = await getAssociatedTokenAddress(usdcMint, toPubkey);

        const rawAmount = Math.floor(amount * 1_000_000);

        // Check if recipient's token account exists, create if not
        const toAccountInfo = await connection.getAccountInfo(toTokenAccount);
        if (!toAccountInfo) {
          instructions.push(
            createAssociatedTokenAccountInstruction(
              feePayer,
              toTokenAccount,
              toPubkey,
              usdcMint
            )
          );
        }

        instructions.push(
          createTransferInstruction(
            fromTokenAccount,
            toTokenAccount,
            fromPubkey,
            rawAmount
          )
        );
      }

      let txSignature = "";

      if (useGasSponsorship) {
        const message = new TransactionMessage({
          payerKey: feePayer,
          recentBlockhash: blockhash,
          instructions,
        }).compileToV0Message();

        const versionedTx = new VersionedTransaction(message);

        let signedBytes: Uint8Array;
        if (context.signTransaction) {
          const signRes = await context.signTransaction({
            transaction: new Uint8Array(versionedTx.serialize()),
            wallet,
          });
          signedBytes = signRes?.signedTransaction ?? signRes;
        } else if (typeof (wallet as any).signTransaction === "function") {
          const signRes = await (wallet as any).signTransaction({
            transaction: versionedTx.serialize(),
          });
          signedBytes = signRes?.signedTransaction ?? signRes;
        } else {
          throw new Error("Solana wallet does not support signTransaction.");
        }

        const serializedTransaction = Buffer.from(signedBytes).toString("base64");

        const sponsorRes = await apiFetch("/gas-sponsorship/sponsor-transaction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transaction: serializedTransaction }),
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
        const transaction = new Transaction();
        transaction.feePayer = fromPubkey;
        transaction.recentBlockhash = blockhash;
        for (const ix of instructions) {
          transaction.add(ix);
        }

        let signedBytes: Uint8Array;
        if (context.signTransaction) {
          const signRes = await context.signTransaction({
            transaction: transaction.serialize({ requireAllSignatures: false }),
            wallet,
          });
          signedBytes = signRes?.signedTransaction ?? signRes;
        } else if (typeof (wallet as any).signTransaction === "function") {
          const signRes = await (wallet as any).signTransaction({
            transaction: transaction.serialize({ requireAllSignatures: false }),
          });
          signedBytes = signRes?.signedTransaction ?? signRes;
        } else {
          throw new Error("Solana wallet does not support signTransaction.");
        }

        txSignature = await connection.sendRawTransaction(signedBytes, {
          skipPreflight: false,
          maxRetries: 3,
        });
      }

      // Record transaction in backend
      const privyUserId = context.privyUser?.id;
      if (privyUserId && txSignature) {
        void apiFetch("/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            privyUserId,
            chainType: "solana",
            assetSymbol: asset,
            amount: String(amount),
            direction: "outgoing",
            txSignature,
            fromAddress: owner,
            toAddress: recipientAddress,
            source: "send_wallet",
          }),
        }).catch(() => {});
      }

      context.emitToast(
        "✅",
        "Transfer Successful!",
        `Sent ${amount} ${asset} to ${recipientAddress.slice(0, 4)}...${recipientAddress.slice(-4)}`,
        "success"
      );

      return {
        status: "success",
        message: `Successfully transferred ${amount} ${asset} to ${recipientAddress}`,
        txSignature,
        explorerUrl: `https://solscan.io/tx/${txSignature}`,
        recipientAddress,
        amount,
        asset,
        gasSponsored: useGasSponsorship,
      };
    },
  },
];
