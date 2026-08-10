/**
 * Privy Wallet Service — Server-Side Transaction Signing
 *
 * Provides server-side wallet operations via the Privy Wallet API:
 * - Lookup a user's embedded Solana wallet (address + wallet ID)
 * - Build USDC SPL transfer transactions
 * - Build Lulo savings deposit transactions
 * - Sign and broadcast via Privy's signAndSendTransaction RPC
 *
 * Security: Uses Privy App ID + App Secret for Basic Auth.
 * All transactions are validated against amount limits before execution.
 */

import { PrivyClient } from "@privy-io/server-auth";
import { pool } from "../db.js";
import { resolveUserId } from "../lib/dbHelpers.js";
import crypto from "crypto";
import canonicalize from "canonicalize";

// ── Constants ──────────────────────────────────────────────────────────────────
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDC_DECIMALS = 6;
const LULO_REFERRER = "6pZiqTT81nKLxMvQay7P6TrRx9NdWG5zbakaZdQoWoUb";
const LULO_BASE_URL = "https://api.lulo.fi";
const MAX_IN_CHAT_AMOUNT_USDC = 500; // Maximum single tx for in-chat signing

const PRIVY_API_BASE = "https://api.privy.io/v1";

// ── Environment ────────────────────────────────────────────────────────────────
const privyAppId = process.env.PRIVY_APP_ID || "";
const privyAppSecret = process.env.PRIVY_APP_SECRET || "";
const luloApiKey = process.env.LULO_API_KEY || "";

function getPrivyAuthPrivateKey(): string | undefined {
  return process.env.PRIVY_DELEGATE_SIGNER || process.env.PRIVY_AUTH_PRIVATE_KEY;
}

function getSolanaRpc(): string {
  let rpc = process.env.VITE_SOLANA_RPC || process.env.VITE_HELIUS_RPC_URL || "https://api.mainnet-beta.solana.com";
  return rpc.trim().replace(/^['"]|['"]$/g, "").trim();
}

// ── Privy Client ───────────────────────────────────────────────────────────────
const privy = privyAppId && privyAppSecret
  ? new PrivyClient(privyAppId, privyAppSecret, {
      walletApi: {
        authorizationPrivateKey: getPrivyAuthPrivateKey(),
      },
    })
  : null;

// ── Types ──────────────────────────────────────────────────────────────────────
export interface WalletInfo {
  walletAddress: string;
  walletId: string;  // Privy's internal wallet ID for RPC calls
  chainType: "solana";
}

export interface TransactionResult {
  success: boolean;
  txSignature?: string;
  error?: string;
  solscanUrl?: string;
  // When the user's wallet isn't delegated to the agent, this one-tap link
  // sends them to Corre to authorize the agent so future in-chat signing works.
  authorizeUrl?: string;
}

export interface PendingTransaction {
  id: string;
  type: "transfer" | "savings_deposit" | "savings_withdraw" | "stock_buy" | "stock_sell" | "rebalance";
  privyUserId: string;
  walletAddress: string;
  walletId: string;
  usdcAmount: number;
  // Transfer-specific
  recipientAddress?: string;
  // Savings-specific
  vaultType?: "shielded" | "standard";
  // Stock-specific
  stockSymbol?: string;
  stockMint?: string;
  sharesAmount?: number;
  // Metadata
  createdAt: number;
  executed: boolean;
}

// ── Pending Transaction Store (Redis-backed with in-memory fallback) ───────────
import { redis, redisAvailable } from "../lib/redis.js";

const PENDING_TX_TTL_MS = 5 * 60 * 1000; // 5 minutes
const PENDING_TX_TTL_SEC = Math.floor(PENDING_TX_TTL_MS / 1000);

// In-memory fallback (single-instance only)
const pendingTransactionsMemory = new Map<string, PendingTransaction>();

// Cleanup expired entries every 60s (in-memory only)
setInterval(() => {
  if (redisAvailable) return; // Redis handles TTL automatically
  const now = Date.now();
  for (const [id, tx] of pendingTransactionsMemory) {
    if (now - tx.createdAt > PENDING_TX_TTL_MS || tx.executed) {
      pendingTransactionsMemory.delete(id);
    }
  }
}, 60_000);

export async function storePendingTransaction(tx: PendingTransaction): Promise<void> {
  if (redisAvailable && redis) {
    try {
      await redis.setex(`pending_tx:${tx.id}`, PENDING_TX_TTL_SEC, JSON.stringify(tx));
      return;
    } catch (err) {
      console.error("[PendingTx] Redis store failed, falling back to memory:", err);
    }
  }
  pendingTransactionsMemory.set(tx.id, tx);
}

export async function getPendingTransaction(id: string, ownerPrivyUserId?: string): Promise<PendingTransaction | undefined> {
  if (id) {
    let tx: PendingTransaction | undefined;

    if (redisAvailable && redis) {
      try {
        const data = await redis.get(`pending_tx:${id}`);
        if (data) tx = JSON.parse(data);
      } catch (err) {
        console.error("[PendingTx] Redis get failed, falling back to memory:", err);
      }
    }

    if (!tx) {
      tx = pendingTransactionsMemory.get(id);
    }

    if (tx) {
      if (Date.now() - tx.createdAt > PENDING_TX_TTL_MS) {
        await deletePendingTransaction(id);
        return undefined;
      }
      return tx;
    }
  }

  // Fallback: return the latest unexecuted pending tx within TTL for the owner.
  // Redis fallback requires scanning; for performance, only scan in-memory here.
  // Multi-instance users should use exact IDs.
  const now = Date.now();
  let latestTx: PendingTransaction | undefined = undefined;

  for (const [, pending] of pendingTransactionsMemory) {
    if (ownerPrivyUserId && pending.privyUserId !== ownerPrivyUserId) continue;
    if (!pending.executed && (now - pending.createdAt < PENDING_TX_TTL_MS)) {
      if (!latestTx || pending.createdAt > latestTx.createdAt) {
        latestTx = pending;
      }
    }
  }

  if (latestTx) {
    console.log(`[PrivyWallet] Exact pending ID "${id}" not found. Falling back to active pending transaction "${latestTx.id}" (${latestTx.type}, $${latestTx.usdcAmount} USDC)`);
    return latestTx;
  }

  return undefined;
}

export async function markTransactionExecuted(id: string): Promise<void> {
  if (redisAvailable && redis) {
    try {
      const data = await redis.get(`pending_tx:${id}`);
      if (data) {
        const tx = JSON.parse(data);
        tx.executed = true;
        await redis.setex(`pending_tx:${id}`, PENDING_TX_TTL_SEC, JSON.stringify(tx));
      }
      return;
    } catch (err) {
      console.error("[PendingTx] Redis mark failed, falling back to memory:", err);
    }
  }
  const tx = pendingTransactionsMemory.get(id);
  if (tx) tx.executed = true;
}

async function deletePendingTransaction(id: string): Promise<void> {
  if (redisAvailable && redis) {
    try {
      await redis.del(`pending_tx:${id}`);
    } catch (err) {
      console.error("[PendingTx] Redis delete failed:", err);
    }
  }
  pendingTransactionsMemory.delete(id);
}

// ── Helper to validate Privy Wallet IDs ───────────────────────────────────────
function isValidPrivyWalletId(id?: string): boolean {
  if (!id || typeof id !== "string") return false;
  const trimmed = id.trim();
  // Solana base58 public keys are 32-44 chars base58. Privy wallet IDs are CUIDs/UUIDs like "clx...", "cm...", "w_..."
  // If it matches a 32-44 base58 address, it's a Solana address, NOT a Privy wallet ID.
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed)) {
    return false;
  }
  return trimmed.length > 5;
}

/**
 * Gets real Privy wallet details (address + Privy wallet ID) for a user via Privy API.
 */
async function getPrivyWalletDetails(
  privyUserId: string,
  targetAddress?: string
): Promise<{ walletAddress: string; walletId: string } | null> {
  if (!privy || !privyUserId) return null;

  try {
    const pUser = await privy.getUser(privyUserId).catch(() => null);
    if (!pUser || !pUser.linkedAccounts) return null;

    const solWallets = pUser.linkedAccounts.filter(
      (a: any) =>
        (a.type === "wallet" || a.type === "solana") &&
        ((a as any).chainType === "solana" || (a as any).chain_type === "solana" || ((a as any).address && !(a as any).chainType))
    );

    console.log(`[PrivyWallet] Found ${solWallets.length} Solana wallets for Privy user ${privyUserId}`);

    // Try case-insensitive address match first
    for (const w of solWallets) {
      const addr = (w as any).address;
      const wId = (w as any).id || (w as any).walletId;

      if (targetAddress && addr) {
        if (addr.toLowerCase().trim() === targetAddress.toLowerCase().trim()) {
          if (isValidPrivyWalletId(wId)) {
            return { walletAddress: addr, walletId: wId };
          }
        }
      }
    }

    // Fall back to first Solana wallet with a valid Privy wallet ID
    for (const w of solWallets) {
      const addr = (w as any).address;
      const wId = (w as any).id || (w as any).walletId;
      if (addr && isValidPrivyWalletId(wId)) {
        return { walletAddress: addr, walletId: wId };
      }
    }
  } catch (err) {
    console.error(`[PrivyWallet] Error fetching Privy wallet details for ${privyUserId}:`, err);
  }

  return null;
}

// ── Wallet Lookup ──────────────────────────────────────────────────────────────
/**
 * Looks up a user's embedded Solana wallet address and Privy wallet ID.
 * Resolves local DB user records and validates Privy API embedded wallet IDs.
 */
export async function lookupUserWallet(privyUserId: string): Promise<WalletInfo | null> {
  if (!privyUserId) return null;

  let actualPrivyUserId = privyUserId;
  let userId: number | null = null;

  // 1. Check if privyUserId is an email address
  if (privyUserId.includes("@")) {
    try {
      const userRes = await pool.query(`SELECT id, privy_user_id FROM users WHERE email = $1`, [privyUserId.toLowerCase()]);
      if (userRes.rows.length > 0) {
        userId = userRes.rows[0].id;
        actualPrivyUserId = userRes.rows[0].privy_user_id;
      }
    } catch (e) {}
  } else {
    try {
      userId = await resolveUserId(privyUserId);
    } catch (e) {}
  }

  // 2. Query local DB for wallet linked to user
  let localAddress: string | undefined;
  if (userId) {
    try {
      const walletRes = await pool.query(
        `SELECT address FROM wallets WHERE user_id = $1 AND chain_type = 'solana' LIMIT 1`,
        [userId]
      );
      localAddress = walletRes.rows[0]?.address;
    } catch (err) {
      console.warn("[PrivyWallet] DB wallet lookup failed:", err);
    }
  }

  // 3. Fetch real Privy Wallet Details (walletAddress & valid Privy walletId) via Privy API
  const details = await getPrivyWalletDetails(actualPrivyUserId, localAddress);
  if (details) {
    return {
      walletAddress: details.walletAddress,
      walletId: isValidPrivyWalletId(details.walletId) ? details.walletId : "",
      chainType: "solana",
    };
  }

  if (localAddress) {
    return {
      walletAddress: localAddress,
      walletId: "",
      chainType: "solana",
    };
  }

  return null;
}

// ── Amount Validation ──────────────────────────────────────────────────────────
export function validateInChatAmount(usdcAmount: number): { valid: boolean; reason?: string } {
  if (!usdcAmount || !isFinite(usdcAmount) || usdcAmount <= 0) {
    return { valid: false, reason: "Invalid amount. Please provide a positive number." };
  }
  if (usdcAmount > MAX_IN_CHAT_AMOUNT_USDC) {
    return {
      valid: false,
      reason: `In-chat transactions are limited to $${MAX_IN_CHAT_AMOUNT_USDC} USDC. For larger amounts, please use the Corre web app.`,
    };
  }
  return { valid: true };
}

// ── Build USDC Transfer Transaction ────────────────────────────────────────────
/**
 * Constructs a raw Solana SPL TransferChecked transaction for USDC.
 */
export async function buildUsdcTransferTx(
  senderAddress: string,
  recipientAddress: string,
  usdcAmount: number,
  feePayerAddress?: string
): Promise<string> {
  const {
    Connection,
    PublicKey,
    Transaction,
  } = await import("@solana/web3.js");
  const {
    createTransferCheckedInstruction,
    createAssociatedTokenAccountIdempotentInstruction,
    getAssociatedTokenAddress,
  } = await import("@solana/spl-token");

  const connection = new Connection(getSolanaRpc(), "confirmed");
  const senderPubkey = new PublicKey(senderAddress);
  const recipientPubkey = new PublicKey(recipientAddress);
  const mintPubkey = new PublicKey(USDC_MINT);
  const payerPubkey = feePayerAddress ? new PublicKey(feePayerAddress) : senderPubkey;

  const senderAta = await getAssociatedTokenAddress(mintPubkey, senderPubkey);
  const recipientAta = await getAssociatedTokenAddress(mintPubkey, recipientPubkey);

  const rawAmount = BigInt(Math.round(usdcAmount * Math.pow(10, USDC_DECIMALS)));

  const tx = new Transaction();

  // Ensure the recipient's USDC associated token account exists. If it does not,
  // TransferChecked fails simulation with InvalidAccountData. The idempotent
  // instruction is a no-op when the ATA already exists, so it's always safe to include.
  const recipientAtaInfo = await connection.getAccountInfo(recipientAta);
  if (!recipientAtaInfo) {
    tx.add(
      createAssociatedTokenAccountIdempotentInstruction(
        payerPubkey,
        recipientAta,
        recipientPubkey,
        mintPubkey
      )
    );
  }

  const transferInstruction = createTransferCheckedInstruction(
    senderAta,
    mintPubkey,
    recipientAta,
    senderPubkey,
    rawAmount,
    USDC_DECIMALS
  );

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = payerPubkey;
  tx.add(transferInstruction);

  return tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64");
}

// ── Build Lulo Savings Deposit Transaction ─────────────────────────────────────
/**
 * Fetches a deposit transaction from Lulo API for savings yield deposits.
 */
export async function buildSavingsDepositTx(
  userAddress: string,
  usdcAmount: number,
  vaultType: "shielded" | "standard" = "shielded",
  feePayerAddress?: string
): Promise<string> {
  const isShielded = vaultType === "shielded";
  const poolName = isShielded ? "flex-protected" : "flex-regular";
  const depositUrl = `${LULO_BASE_URL}/v1/pool/deposit?priorityFee=50000`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (luloApiKey) headers["x-api-key"] = luloApiKey;

  const body = {
    owner: userAddress,
    mint: USDC_MINT,
    amount: usdcAmount,
    poolName,
    referrer: LULO_REFERRER,
    feePayer: feePayerAddress || userAddress,
  };

  const response = await fetch(depositUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[PrivyWallet] Lulo deposit API error:", errorText);
    throw new Error(`Failed to generate Lulo deposit transaction: ${errorText}`);
  }

  const data = await response.json();
  const encodedTx: string | undefined =
    (data as any)?.transaction ||
    (data as any)?.tx ||
    (data as any)?.transactions?.[0]?.transaction;

  if (!encodedTx || typeof encodedTx !== "string") {
    throw new Error("Deposit transaction not found in Lulo response.");
  }

  return encodedTx;
}

/**
 * Fetches a withdrawal transaction from Lulo API for savings yield withdrawals.
 */
export async function buildSavingsWithdrawTx(
  userAddress: string,
  usdcAmount: number,
  vaultType: "shielded" | "standard" = "shielded",
  feePayerAddress?: string
): Promise<string> {
  const isShielded = vaultType === "shielded";
  const poolName = isShielded ? "flex-protected" : "flex-regular";
  const withdrawUrl = `${LULO_BASE_URL}/v1/pool/withdraw?priorityFee=50000`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (luloApiKey) headers["x-api-key"] = luloApiKey;

  const body = {
    owner: userAddress,
    mint: USDC_MINT,
    amount: usdcAmount,
    poolName,
    feePayer: feePayerAddress || userAddress,
  };

  const response = await fetch(withdrawUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[PrivyWallet] Lulo withdraw API error:", errorText);
    throw new Error(`Failed to generate Lulo withdrawal transaction: ${errorText}`);
  }

  const data = await response.json();
  const encodedTx: string | undefined =
    (data as any)?.transaction ||
    (data as any)?.tx ||
    (data as any)?.transactions?.[0]?.transaction;

  if (!encodedTx || typeof encodedTx !== "string") {
    throw new Error("Withdrawal transaction not found in Lulo response.");
  }

  return encodedTx;
}

// ── Canonical Signature helper for Privy REST Wallet API ───────────────────────
// Implements Privy's required signing flow per docs:
// https://docs.privy.io/controls/authorization-keys/using-owners/sign/direct-implementation
//
// Steps:
// 1. Build payload object {version, method, url, body, headers}
// 2. RFC 8785 canonicalize (sorted keys, minimal separators)
// 3. Sign with crypto.sign('sha256', buffer, privateKey) — outputs DER base64

function signPrivyRpcRequest(
  method: string,
  url: string,
  body: object,
  expiryTimestamp: number
): string | null {
  const rawKey = getPrivyAuthPrivateKey();
  if (!rawKey) return null;

  try {
    // Strip the 'wallet-auth:' prefix and wrap in PEM format
    const keyBase64 = rawKey.replace(/^wallet-auth:/i, "").trim();
    const privateKeyPem = `-----BEGIN PRIVATE KEY-----\n${keyBase64}\n-----END PRIVATE KEY-----`;
    const privateKey = crypto.createPrivateKey({ key: privateKeyPem, format: "pem" });

    // Build the signature payload exactly per Privy's spec
    const payloadToSign: Record<string, unknown> = {
      version: 1,
      method: method.toUpperCase(),
      url,
      body,
      headers: {
        "privy-app-id": privyAppId,
        // Must be a string to exactly match the `privy-request-expiry` header value sent
        // on the request. RFC 8785 canonicalization is type-sensitive, so signing a number
        // here while sending a string header produces a mismatched signature → Privy 401.
        "privy-request-expiry": String(expiryTimestamp),
      },
    };

    // RFC 8785 JSON canonicalization (sorted keys, minimal whitespace)
    const serializedPayload = canonicalize(payloadToSign) as string;
    const payloadBuffer = Buffer.from(serializedPayload);

    console.log(`[PrivyWallet] Signing payload for Privy RPC (expiry: ${expiryTimestamp}):`, serializedPayload.slice(0, 200));

    // Sign using crypto.sign() — produces DER-encoded ECDSA signature in base64
    const signatureBuffer = crypto.sign("sha256", payloadBuffer, privateKey);
    return signatureBuffer.toString("base64");
  } catch (err) {
    console.warn("[PrivyWallet] Failed to create RPC authorization signature:", err);
    return null;
  }
}

// ── Sign and Send via Privy Wallet API ─────────────────────────────────────────
/**
 * Signs and broadcasts a Solana transaction using Privy's Wallet API.
 *
 * Uses Basic Auth with PRIVY_APP_ID:PRIVY_APP_SECRET and PRIVY_AUTH_PRIVATE_KEY signature.
 * The wallet must be an embedded wallet managed by the Privy app.
 *
 * @param walletId - Privy's internal wallet ID (from linkedAccounts)
 * @param base64Transaction - Base64-encoded serialized transaction
 * @returns Transaction signature/hash
 */
export async function signAndSendViaPrivy(
  walletId: string,
  base64Transaction: string
): Promise<string> {
  // Solana mainnet CAIP-2 identifier
  const caip2 = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";

  const rpcPayload = {
    method: "signAndSendTransaction",
    caip2,
    params: {
      transaction: base64Transaction,
      encoding: "base64",
    },
  };

  console.log(`[PrivyWallet] Calling signAndSendTransaction for wallet ${walletId}`);

  const result = await postPrivyWalletRpc(walletId, rpcPayload);
  const txHash = result?.data?.hash || result?.hash || result?.data?.signature || result?.signature || "";

  if (!txHash) {
    console.error("[PrivyWallet] No tx hash in response:", JSON.stringify(result));
    throw new Error("Transaction was submitted but no signature was returned.");
  }

  console.log(`[PrivyWallet] Transaction signed and sent: ${txHash}`);
  return txHash;
}

/**
 * Signs a transaction with the user's Privy wallet WITHOUT broadcasting it.
 *
 * Used for gas-sponsored transactions: Privy applies the user's signature, then the
 * fee payer co-signs and we broadcast. Mirrors the frontend + sponsorTransaction flow.
 *
 * @returns Base64-encoded transaction with the user's signature applied.
 */
export async function signViaPrivy(
  walletId: string,
  base64Transaction: string
): Promise<string> {
  const rpcPayload = {
    method: "signTransaction",
    params: {
      transaction: base64Transaction,
      encoding: "base64",
    },
  };

  console.log(`[PrivyWallet] Calling signTransaction (sign-only) for wallet ${walletId}`);

  const result = await postPrivyWalletRpc(walletId, rpcPayload);
  const signed = result?.data?.signed_transaction || result?.signed_transaction || "";

  if (!signed) {
    console.error("[PrivyWallet] No signed_transaction in response:", JSON.stringify(result));
    throw new Error("Privy did not return a signed transaction.");
  }

  return signed;
}

/**
 * Co-signs a user-signed transaction with the fee payer (gas sponsor) key and broadcasts it.
 *
 * The fee payer private key (FEE_PAYER_PRIVATE_KEY, base58) is the same key used by the
 * backend's /gas-sponsorship/sponsor-transaction endpoint. Handles both legacy and
 * versioned transactions.
 */
async function coSignWithFeePayerAndBroadcast(signedBase64Tx: string): Promise<string> {
  const feePayerKey = process.env.FEE_PAYER_PRIVATE_KEY;
  if (!feePayerKey) {
    throw new Error("Gas sponsorship is unavailable: FEE_PAYER_PRIVATE_KEY is not configured.");
  }

  const { Keypair, Connection, Transaction, VersionedTransaction } = await import("@solana/web3.js");
  const bs58 = (await import("bs58")).default;

  const feePayerWallet = Keypair.fromSecretKey(bs58.decode(feePayerKey));
  const connection = new Connection(getSolanaRpc(), "confirmed");

  const txBuffer = Buffer.from(signedBase64Tx, "base64");

  // Versioned transactions set the high bit of the first byte; legacy transactions
  // start with a compact-u16 signature count (< 0x80).
  const isVersioned = (txBuffer[0] & 0x80) !== 0;

  let rawTx: Buffer | Uint8Array;
  if (isVersioned) {
    const vtx = VersionedTransaction.deserialize(txBuffer);
    vtx.sign([feePayerWallet]); // fills the fee payer's signature slot
    rawTx = vtx.serialize();
  } else {
    const legacyTx = Transaction.from(txBuffer);
    legacyTx.partialSign(feePayerWallet); // adds fee payer sig, preserves user sig
    rawTx = legacyTx.serialize();
  }

  const signature = await connection.sendRawTransaction(rawTx);
  console.log(`[PrivyWallet] Sponsored transaction co-signed and broadcast: ${signature}`);
  return signature;
}

/**
 * Shared low-level caller for Privy's Wallet RPC endpoint (POST /v1/wallets/{id}/rpc).
 * Applies Basic Auth + the required authorization signature headers.
 */
async function postPrivyWalletRpc(walletId: string, rpcPayload: object): Promise<any> {
  if (!privyAppId || !privyAppSecret) {
    throw new Error("Privy App credentials not configured (PRIVY_APP_ID / PRIVY_APP_SECRET).");
  }

  const authHeader = "Basic " + Buffer.from(`${privyAppId}:${privyAppSecret}`).toString("base64");
  const url = `${PRIVY_API_BASE}/wallets/${walletId}/rpc`;
  const expiryTimestamp = Date.now() + 5 * 60 * 1000; // 5 minutes in future

  const authSig = signPrivyRpcRequest("POST", url, rpcPayload, expiryTimestamp);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": authHeader,
    "privy-app-id": privyAppId,
    "privy-request-expiry": String(expiryTimestamp),
  };

  if (authSig) {
    headers["privy-authorization-signature"] = authSig;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(rpcPayload),
  });

  if (!response.ok) {
    const errBody = await response.text();
    console.error(`[PrivyWallet] RPC call failed (${response.status}):`, errBody);
    throw new Error(`Privy signing failed (${response.status}): ${errBody}`);
  }

  return response.json();
}

// ── Gas Sponsorship Check ──────────────────────────────────────────────────────
/**
 * Checks gas sponsorship eligibility for a user's transaction.
 * Returns the fee payer address if eligible, null otherwise.
 */
export async function checkGasSponsorship(
  privyUserId: string,
  amountUSD: number,
  backendUrl: string
): Promise<{ sponsored: boolean; feePayerAddress?: string }> {
  try {
    const res = await fetch(`${backendUrl}/gas-sponsorship/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ privyUserId, amountUSD }),
    });

    if (!res.ok) return { sponsored: false };

    const data = await res.json();
    if (!data.allowed) return { sponsored: false };

    if (data.sponsorshipAllowed !== false && data.feePayerAddress) {
      return { sponsored: true, feePayerAddress: data.feePayerAddress };
    }

    return { sponsored: false };
  } catch (err) {
    console.warn("[PrivyWallet] Gas sponsorship check failed:", err);
    return { sponsored: false };
  }
}

// ── Execute Pending Transaction ────────────────────────────────────────────────
/**
 * Executes a previously prepared pending transaction.
 * This is the main entry point called by the execute_transaction MCP tool.
 */
export async function executePendingTransaction(
  transactionId: string,
  callerPrivyUserId?: string
): Promise<TransactionResult> {
  const pending = await getPendingTransaction(transactionId, callerPrivyUserId);
  if (!pending) {
    return { success: false, error: "Transaction not found or expired. Please prepare a new transaction." };
  }

  // 🔒 Ownership check: the caller executing the transaction must be the same
  // authenticated user who prepared it. Prevents one user from broadcasting
  // another user's pending transaction.
  if (!callerPrivyUserId || pending.privyUserId !== callerPrivyUserId) {
    return { success: false, error: "You are not authorized to execute this transaction." };
  }

  if (pending.executed) {
    return { success: false, error: "This transaction has already been executed." };
  }

  // Validate amount limits.
  // Stock sells are denominated in shares (usdcAmount is 0), so validate the
  // share quantity instead of the USDC notional for that type.
  if (pending.type === "stock_sell") {
    if (!pending.sharesAmount || !isFinite(pending.sharesAmount) || pending.sharesAmount <= 0) {
      return { success: false, error: "Invalid share amount. Please prepare a new sell order." };
    }
  } else {
    const amountCheck = validateInChatAmount(pending.usdcAmount);
    if (!amountCheck.valid) {
      return { success: false, error: amountCheck.reason };
    }
  }

  try {
    let base64Tx: string;

    // Determine the backend URL for gas sponsorship check
    const backendUrl = process.env.BACKEND_URL || process.env.APP_URL || "http://localhost:3001";

    // Check gas sponsorship eligibility
    const gasSponsor = await checkGasSponsorship(pending.privyUserId, pending.usdcAmount, backendUrl);
    const feePayerAddress = gasSponsor.sponsored ? gasSponsor.feePayerAddress : undefined;

    // Build the transaction based on type
    switch (pending.type) {
      case "transfer": {
        if (!pending.recipientAddress) {
          return { success: false, error: "Recipient address missing from transaction." };
        }
        base64Tx = await buildUsdcTransferTx(
          pending.walletAddress,
          pending.recipientAddress,
          pending.usdcAmount,
          feePayerAddress
        );
        break;
      }
      case "savings_deposit": {
        base64Tx = await buildSavingsDepositTx(
          pending.walletAddress,
          pending.usdcAmount,
          pending.vaultType || "shielded",
          feePayerAddress
        );
        break;
      }
      case "savings_withdraw": {
        base64Tx = await buildSavingsWithdrawTx(
          pending.walletAddress,
          pending.usdcAmount,
          pending.vaultType || "shielded",
          feePayerAddress
        );
        break;
      }
      case "stock_buy": {
        const stockMint = pending.stockMint || "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB";
        base64Tx = await buildJupiterStockSwapTx(
          pending.walletAddress,
          USDC_MINT,
          stockMint,
          pending.usdcAmount,
          6
        );
        break;
      }
      case "stock_sell": {
        const stockMint = pending.stockMint || "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB";
        const shares = pending.sharesAmount || 1;
        base64Tx = await buildJupiterStockSwapTx(
          pending.walletAddress,
          stockMint,
          USDC_MINT,
          shares,
          6
        );
        break;
      }
      default:
        return { success: false, error: `Unknown transaction type: ${pending.type}` };
    }

    // Ensure walletId is valid for Privy server signing
    if (!isValidPrivyWalletId(pending.walletId)) {
      const appBaseUrl = (
        process.env.FRONTEND_URL ||
        process.env.APP_URL ||
        process.env.VITE_APP_URL ||
        "http://localhost:8080"
      ).trim().replace(/\/+$/, "");
      return {
        success: false,
        error:
          "Your wallet isn't authorized for in-chat signing yet. Tap the link to authorize your AI agent in Corre (one-time), then ask me to run this again.",
        authorizeUrl: `${appBaseUrl}/login`,
      };
    }

    // Sign and send via Privy.
    // If the transaction is gas-sponsored, its fee payer is the sponsor address, so Privy
    // can only apply the user's signature — the fee payer must co-sign before broadcast.
    // Otherwise the user's wallet is the fee payer and Privy can sign + send in one call.
    let txSignature: string;
    if (feePayerAddress) {
      const userSignedTx = await signViaPrivy(pending.walletId, base64Tx);
      txSignature = await coSignWithFeePayerAndBroadcast(userSignedTx);
    } else {
      txSignature = await signAndSendViaPrivy(pending.walletId, base64Tx);
    }

    // Mark as executed
    await markTransactionExecuted(transactionId);

    // Record in DB (fire-and-forget)
    recordTransaction(pending, txSignature).catch((err) =>
      console.error("[PrivyWallet] Failed to record transaction:", err)
    );

    const solscanUrl = `https://solscan.io/tx/${txSignature}`;

    return {
      success: true,
      txSignature,
      solscanUrl,
    };
  } catch (err: any) {
    console.error("[PrivyWallet] Transaction execution failed:", err);
    const rawError = err?.message || String(err);
    const userFriendlyError = formatUserFriendlySolanaError(rawError);

    return {
      success: false,
      error: userFriendlyError,
    };
  }
}

/**
 * Converts raw RPC, Solana, or Privy errors into user-friendly explanations.
 */
export function formatUserFriendlySolanaError(rawError: string): string {
  if (!rawError) return "Transaction execution failed. Please try again or use the Corre app.";

  // Insufficient Funds / Custom: 1 (SPL Token 0x1)
  if (
    rawError.includes(`"Custom":1`) ||
    rawError.includes(`"Custom": 1`) ||
    rawError.includes("Custom:1") ||
    rawError.includes("InsufficientFunds") ||
    rawError.includes("insufficient lamports") ||
    rawError.includes("insufficient funds") ||
    rawError.includes("0x1")
  ) {
    return "Insufficient Balance: Your Solana wallet does not have enough USDC (or SOL for gas fees) to complete this transaction. Please fund your wallet and try again.";
  }

  // Price Slippage
  if (rawError.includes("Slippage") || rawError.includes("0x1771") || rawError.includes("PriceSlippage")) {
    return "Price Moved (Slippage Exceeded): Market prices changed before confirmation. Please try again.";
  }

  // Authorization / Session
  if (rawError.includes("Unauthorized") || rawError.includes("not authorized") || rawError.includes("invalid token")) {
    return "Session Authorization Required: Your wallet session expired. Please sign into Corre to authorize your AI agent.";
  }

  // Unpack JSON nested error strings (e.g. {"error":"Error broadcasting transaction with message: ..."})
  let cleaned = rawError;
  try {
    const match = rawError.match(/\{"error":.*?\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed.error) cleaned = parsed.error;
    }
  } catch {
    // Keep rawError if JSON parsing fails
  }

  // Strip technical RPC prefix wrappers
  cleaned = cleaned
    .replace(/^Privy signing failed \(\d+\):\s*/, "")
    .replace(/^Error broadcasting transaction with message:\s*/, "")
    .replace(/^Error:\s*/, "")
    .replace(/\\"/g, '"')
    .trim();

  if (cleaned.includes("Custom") && cleaned.includes("1")) {
    return "Insufficient Balance: Your Solana wallet does not have enough USDC (or SOL for gas fees) to complete this transaction. Please fund your wallet and try again.";
  }

  return cleaned.length > 0 ? cleaned : "Transaction failed. Please verify your wallet balance and try again.";
}

// ── Record Transaction in DB ───────────────────────────────────────────────────
async function recordTransaction(pending: PendingTransaction, txSignature: string): Promise<void> {
  try {
    const userId = await resolveUserId(pending.privyUserId);
    if (!userId) return;

    if (pending.type === "transfer") {
      await pool.query(
        `INSERT INTO transactions (user_id, chain_type, asset_symbol, amount, direction, tx_signature, from_address, to_address, source)
         VALUES ($1, 'solana', 'USDC', $2, 'outgoing', $3, $4, $5, 'mcp_in_chat')`,
        [userId, pending.usdcAmount.toString(), txSignature, pending.walletAddress, pending.recipientAddress]
      );
    } else if (pending.type === "savings_deposit") {
      const vaultLabel = pending.vaultType === "shielded" ? "lulo_vault_protected" : "lulo_vault_standard";
      await pool.query(
        `INSERT INTO transactions (user_id, chain_type, asset_symbol, amount, direction, tx_signature, from_address, to_address, source)
         VALUES ($1, 'solana', 'USDC', $2, 'outgoing', $3, $4, $5, 'mcp_in_chat')`,
        [userId, pending.usdcAmount.toString(), txSignature, pending.walletAddress, vaultLabel]
      );
    } else if (pending.type === "stock_buy") {
      await pool.query(
        `INSERT INTO transactions (user_id, chain_type, asset_symbol, amount, direction, tx_signature, from_address, to_address, source)
         VALUES ($1, 'solana', $2, $3, 'outgoing', $4, $5, $6, 'mcp_in_chat')`,
        [userId, pending.stockSymbol || "STOCK", pending.usdcAmount.toString(), txSignature, pending.walletAddress, pending.stockMint || "Jupiter"]
      );
    } else if (pending.type === "stock_sell") {
      await pool.query(
        `INSERT INTO transactions (user_id, chain_type, asset_symbol, amount, direction, tx_signature, from_address, to_address, source)
         VALUES ($1, 'solana', $2, $3, 'incoming', $4, $5, $6, 'mcp_in_chat')`,
        [userId, pending.stockSymbol || "STOCK", (pending.sharesAmount || 1).toString(), txSignature, pending.walletAddress, "USDC"]
      );
    }
  } catch (err) {
    console.error("[PrivyWallet] DB record error:", err);
  }
}

/**
 * Builds a Jupiter Swap transaction (base64 serialized) for swapping USDC <-> Tokenized Stock.
 */
export async function buildJupiterStockSwapTx(
  userAddress: string,
  inputMint: string,
  outputMint: string,
  amount: number,
  decimals: number = 6
): Promise<string> {
  const rawAmount = Math.round(amount * (10 ** decimals));

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const jupApiKey = process.env.VITE_JUP_API_KEY || process.env.JUPITER_API_KEY;
  if (jupApiKey) {
    headers["x-api-key"] = jupApiKey;
  }

  // 1. Try Jupiter Ultra API v2 order endpoint (exact match to frontend useTradeDialog)
  const orderUrl = `https://api.jup.ag/swap/v2/order?inputMint=${inputMint}&outputMint=${outputMint}&amount=${rawAmount}&taker=${userAddress}&referralAccount=5VAt8EHw6jQuSC3X2ezTZDmF9pfLrLnoZLbVwMP7B8Ga&referralFee=100`;

  const orderRes = await fetch(orderUrl, { method: "GET", headers });
  if (orderRes.ok) {
    const data: any = await orderRes.json().catch(() => null);
    if (data?.transaction) {
      return data.transaction;
    }
  }

  // 2. Fallback: Jupiter V6 Quote & Swap API
  const quoteUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${rawAmount}&slippageBps=100`;
  const quoteRes = await fetch(quoteUrl, { headers });
  if (!quoteRes.ok) {
    const errText = await quoteRes.text().catch(() => "");
    console.error("[JupiterSwap] Quote failed:", quoteRes.status, errText);
    throw new Error(`Failed to fetch stock quote from Jupiter (${quoteRes.status}): ${errText || quoteRes.statusText}`);
  }
  const quoteData = await quoteRes.json();

  const swapRes = await fetch("https://quote-api.jup.ag/v6/swap", {
    method: "POST",
    headers,
    body: JSON.stringify({
      quoteResponse: quoteData,
      userPublicKey: userAddress,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
    }),
  });

  if (!swapRes.ok) {
    const errText = await swapRes.text().catch(() => "");
    console.error("[JupiterSwap] Build swap failed:", swapRes.status, errText);
    throw new Error(`Failed to build Jupiter stock swap transaction (${swapRes.status}): ${errText || swapRes.statusText}`);
  }

  const swapData = await swapRes.json();
  if (!swapData?.swapTransaction) {
    throw new Error("Jupiter did not return a valid swap transaction payload.");
  }

  return swapData.swapTransaction;
}

// ── UUID Generator ─────────────────────────────────────────────────────────────
export function generateTransactionId(): string {
  // Simple UUID v4 without external deps
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Scans pending_withdrawals for records whose 24-hour cooldown has elapsed,
 * and automatically signs & broadcasts the final claim transaction via Privy.
 */
export async function processAutomatedBackgroundWithdrawalClaims(): Promise<{ processedCount: number; successCount: number }> {
  try {
    const query = `
      SELECT pw.id, pw.privy_user_id, pw.owner, pw.withdrawal_id, pw.mint_address, pw.native_amount,
             pw.created_timestamp, pw.cooldown_seconds
        FROM pending_withdrawals pw
       WHERE pw.completed = FALSE
         AND (EXTRACT(EPOCH FROM NOW()) >= (pw.created_timestamp + pw.cooldown_seconds))
       ORDER BY pw.created_timestamp ASC
       LIMIT 20
    `;

    const { rows } = await pool.query(query);
    if (!rows || rows.length === 0) {
      return { processedCount: 0, successCount: 0 };
    }

    console.log(`[AutoClaimWorker] Found ${rows.length} pending withdrawals ready for auto-claim.`);
    let successCount = 0;

    for (const row of rows) {
      try {
        const wallet = await lookupUserWallet(row.privy_user_id);
        if (!wallet || !wallet.walletId) {
          console.warn(`[AutoClaimWorker] No Privy wallet found for user ${row.privy_user_id}`);
          continue;
        }

        const amountUsdc = Number(row.native_amount) / 1_000_000 || 0;
        const base64Tx = await buildSavingsWithdrawTx(row.owner || wallet.walletAddress, amountUsdc, "standard");

        // Sign & Broadcast via Privy
        const txSignature = await signAndSendViaPrivy(wallet.walletId, base64Tx);

        // Mark as completed
        await pool.query(
          `UPDATE pending_withdrawals SET completed = TRUE, completed_at = NOW() WHERE id = $1`,
          [row.id]
        );

        // Record in transactions log
        const userId = await resolveUserId(row.privy_user_id);
        if (userId) {
          await pool.query(
            `INSERT INTO transactions (user_id, chain_type, asset_symbol, amount, direction, tx_signature, from_address, to_address, source)
             VALUES ($1, 'solana', 'USDC', $2, 'incoming', $3, 'lulo_vault_standard', $4, 'auto_claim_background')`,
            [userId, amountUsdc.toString(), txSignature, wallet.walletAddress]
          );
        }

        console.log(`[AutoClaimWorker] Successfully auto-claimed withdrawal #${row.withdrawal_id} for user ${row.privy_user_id}: ${txSignature}`);
        successCount++;
      } catch (claimErr) {
        console.error(`[AutoClaimWorker] Failed to auto-claim withdrawal #${row.withdrawal_id}:`, claimErr);
      }
    }

    return { processedCount: rows.length, successCount };
  } catch (err) {
    console.error("[AutoClaimWorker] Error in background auto-claim worker:", err);
    return { processedCount: 0, successCount: 0 };
  }
}
