/**
 * getEquityService.ts
 *
 * Core service for interacting with GetEquity's on-chain Real-World Asset (RWA)
 * protocol on Solana.
 *
 * Documentation reference:
 * - https://getequity.io/docs/onchain/solana-programs
 * - https://getequity.io/docs/onchain/solana-addresses
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  AddressLookupTableAccount,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  unpackMint,
  getTransferHook,
} from "@solana/spl-token";
import { Buffer } from "buffer";


// ─── Program IDs & Connection ───────────────────────────────────────────────────

export const RWA_MARKET_PROGRAM_ID = new PublicKey(
  import.meta.env.VITE_GETEQUITY_MARKET_PROGRAM_ID ||
  "Fv7op93iVyTGKVeD3bQvh3dsi6u5g8ULyvvg48dRqWqe"
);

export const RWA_TOKEN_PROGRAM_ID = new PublicKey(
  import.meta.env.VITE_GETEQUITY_TOKEN_PROGRAM_ID ||
  "8eiSiyHwkB3s5x4jNEWrfnPFyWULYMRApFe8ungsu9Gy"
);

export const RWA_VAULT_PROGRAM_ID = new PublicKey(
  import.meta.env.VITE_GETEQUITY_VAULT_PROGRAM_ID ||
  "A5SYMN5DGKWo8oPwDgWUxCZHZA7TaCkLbguSrLiWc91"
);

export const RWA_EXIT_PROGRAM_ID = new PublicKey(
  import.meta.env.VITE_GETEQUITY_EXIT_PROGRAM_ID ||
  "7q7cns2MDf2sNVtwGHczub2oTrz8YjqFutEHHJZuQKqc"
);

export const RWA_ACCRUAL_PROGRAM_ID = new PublicKey(
  import.meta.env.VITE_GETEQUITY_ACCRUAL_PROGRAM_ID ||
  "BhQAF2HBBFvtpG4dYYkqEtzpndSQGHzsNCBns8t6XXkw"
);

/**
 * Returns a configured Connection for GetEquity on Solana,
 * reading from VITE_GETEQUITY_SOLANA_RPC or VITE_SOLANA_RPC with a fallback to mainnet-beta.
 */
export function getGetEquityConnection(cluster?: "mainnet-beta" | "devnet"): Connection {
  if (cluster === "devnet") {
    const devnetRpc =
      import.meta.env.VITE_GETEQUITY_SOLANA_DEVNET_RPC ||
      "https://api.devnet.solana.com";
    return new Connection(devnetRpc, "confirmed");
  }
  const mainnetRpc =
    import.meta.env.VITE_GETEQUITY_SOLANA_RPC ||
    import.meta.env.VITE_SOLANA_RPC ||
    "https://api.mainnet-beta.solana.com";
  return new Connection(mainnetRpc, "confirmed");
}


// ─── Well-Known Tokens ───────────────────────────────────────────────────────

export const KNOWN_PAYOUT_MINTS = {
  mainnet: {
    USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    CNGN: "3jiqwBQVRC5zRwHyqvnkQurebJ5RNxg3F5fXMwaxgkv8",
  },
  devnet: {
    USDC: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    CNGN: "HfJWS8vJHvxKn5xW3uLXkTmEy4jny3G45QnS1Eab5sg",
  },
} as const;

// ─── Anchor Discriminators ───────────────────────────────────────────────────

// sha256("global:buy")[0..8]
export const BUY_DISCRIMINATOR = new Uint8Array([102, 6, 61, 18, 1, 218, 235, 234]);

// sha256("global:sell")[0..8]
export const SELL_DISCRIMINATOR = new Uint8Array([51, 230, 133, 164, 1, 127, 131, 173]);

// sha256("global:claim")[0..8]
export const CLAIM_DISCRIMINATOR = new Uint8Array([62, 198, 214, 193, 213, 159, 108, 210]);

// sha256("account:Asset")[0..8]
export const ASSET_ACCOUNT_DISCRIMINATOR = new Uint8Array([234, 180, 241, 252, 139, 224, 160, 8]);

// sha256("account:TokenMeta")[0..8]
export const TOKEN_META_DISCRIMINATOR = new Uint8Array([130, 87, 174, 35, 21, 44, 92, 19]);

// ─── PDA Helpers ─────────────────────────────────────────────────────────────

/**
 * Derives the Asset PDA for an RWA token mint under rwa_market.
 * Seeds: ["asset", mint]
 */
export function getAssetPda(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("asset"), mint.toBuffer()],
    RWA_MARKET_PROGRAM_ID
  );
}

/**
 * Derives the TokenMeta PDA for an RWA token mint under rwa_token.
 * Seeds: ["meta", mint]
 */
export function getTokenMetaPda(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("meta"), mint.toBuffer()],
    RWA_TOKEN_PROGRAM_ID
  );
}

/**
 * Derives the Vault PDA for an RWA token mint under rwa_vault.
 * Seeds: ["vault", mint]
 */
export function getVaultPda(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), mint.toBuffer()],
    RWA_VAULT_PROGRAM_ID
  );
}

/**
 * Derives the ExitState PDA for an RWA token mint under rwa_exit.
 * Seeds: ["exit", mint]
 */
export function getExitPda(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("exit"), mint.toBuffer()],
    RWA_EXIT_PROGRAM_ID
  );
}

/**
 * Derives the holder clock PDA under rwa_accrual.
 * Seeds: ["clock", mint, owner]
 */
export function getHolderClockPda(
  mint: PublicKey,
  owner: PublicKey,
  hookProgramId: PublicKey = RWA_ACCRUAL_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("clock"), mint.toBuffer(), owner.toBuffer()],
    hookProgramId
  );
}

/**
 * Derives the extra account metas PDA for an RWA token mint under rwa_accrual.
 * Seeds: ["extra-account-metas", mint]
 */
export function getExtraAccountMetasPda(
  mint: PublicKey,
  hookProgramId: PublicKey = RWA_ACCRUAL_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("extra-account-metas"), mint.toBuffer()],
    hookProgramId
  );
}

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface RwaAssetAccount {
  mint: PublicKey;
  vault: PublicKey;
  payoutMint: PublicKey;
  admin: PublicKey;
  priceUpdater: PublicKey;
  priceCents: bigint;
  priceUSD: number;
  feeBps: number;
  feePercent: number;
  isActive: boolean;
  maxPerTx: bigint;
  maxPerUser: bigint;
  bump: number;
}

export interface RwaTokenMeta {
  mint: PublicKey;
  admin: PublicKey;
  minter: PublicKey;
  automation: PublicKey;
  vault: PublicKey;
  payoutToken: PublicKey;
  name: string;
  symbol: string;
  issuer: string;
  dealUrl: string;
  investmentType: number;
  investmentCategory: number;
  payoutFrequency: number;
  tokenEntityType: number;
  interestRateBps: number;
  maturityDate: bigint;
  tenorDays: number;
  decimals: number;
  bump: number;
}

export interface RwaMarketOverview {
  mint: string;
  asset: RwaAssetAccount;
  meta: RwaTokenMeta | null;
  vaultRwaBalance: string;
  vaultPayoutBalance: string;
  payoutTokenProgram: PublicKey;
  payoutDecimals: number;
  rwaDecimals: number;
}

export interface BuyQuote {
  amountUnits: bigint;
  amountDisplay: number;
  proceedsUnits: bigint;
  feeUnits: bigint;
  totalCostUnits: bigint;
  maxCostUnits: bigint;
  unitPriceUSD: number;
  totalCostUSD: number;
  feeUSD: number;
  slippageBps: number;
}

export interface SellQuote {
  amountUnits: bigint;
  amountDisplay: number;
  proceedsUnits: bigint;
  feeUnits: bigint;
  netProceedsUnits: bigint;
  minProceedsUnits: bigint;
  unitPriceUSD: number;
  netProceedsUSD: number;
  feeUSD: number;
  slippageBps: number;
}

// ─── Deserializers ───────────────────────────────────────────────────────────

/**
 * Parses the 196-byte Asset account buffer from the rwa_market program.
 */
export function parseAssetAccount(data: Uint8Array | Buffer): RwaAssetAccount {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  if (buf.length < 196) {
    throw new Error(`Invalid Asset account buffer length: ${buf.length}, expected at least 196`);
  }

  const mint = new PublicKey(buf.subarray(8, 40));
  const vault = new PublicKey(buf.subarray(40, 72));
  const payoutMint = new PublicKey(buf.subarray(72, 104));
  const admin = new PublicKey(buf.subarray(104, 136));
  const priceUpdater = new PublicKey(buf.subarray(136, 168));
  const priceCents = buf.readBigUInt64LE(168);
  const feeBps = buf.readUInt16LE(176);
  const isActive = buf.readUInt8(178) !== 0;
  const maxPerTx = buf.readBigUInt64LE(179);
  const maxPerUser = buf.readBigUInt64LE(187);
  const bump = buf.readUInt8(195);

  return {
    mint,
    vault,
    payoutMint,
    admin,
    priceUpdater,
    priceCents,
    priceUSD: Number(priceCents) / 100,
    feeBps,
    feePercent: feeBps / 100,
    isActive,
    maxPerTx,
    maxPerUser,
    bump,
  };
}

/**
 * Parses the variable-length TokenMeta account buffer from the rwa_token program.
 */
export function parseTokenMetaAccount(data: Uint8Array | Buffer): RwaTokenMeta {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  let offset = 8; // skip 8-byte discriminator

  const mint = new PublicKey(buf.subarray(offset, offset + 32));
  offset += 32;
  const admin = new PublicKey(buf.subarray(offset, offset + 32));
  offset += 32;
  const minter = new PublicKey(buf.subarray(offset, offset + 32));
  offset += 32;
  const automation = new PublicKey(buf.subarray(offset, offset + 32));
  offset += 32;
  const vault = new PublicKey(buf.subarray(offset, offset + 32));
  offset += 32;
  const payoutToken = new PublicKey(buf.subarray(offset, offset + 32));
  offset += 32;

  const readBorshString = (): string => {
    const len = buf.readUInt32LE(offset);
    offset += 4;
    const str = buf.subarray(offset, offset + len).toString("utf8");
    offset += len;
    return str;
  };

  const name = readBorshString();
  const symbol = readBorshString();
  const issuer = readBorshString();
  const dealUrl = readBorshString();

  const investmentType = buf.readUInt8(offset);
  offset += 1;
  const investmentCategory = buf.readUInt8(offset);
  offset += 1;
  const payoutFrequency = buf.readUInt8(offset);
  offset += 1;
  const tokenEntityType = buf.readUInt8(offset);
  offset += 1;
  const interestRateBps = buf.readUInt16LE(offset);
  offset += 2;
  const maturityDate = buf.readBigInt64LE(offset);
  offset += 8;
  const tenorDays = buf.readUInt32LE(offset);
  offset += 4;
  const decimals = buf.readUInt8(offset);
  offset += 1;
  const bump = buf.readUInt8(offset);
  offset += 1;

  return {
    mint,
    admin,
    minter,
    automation,
    vault,
    payoutToken,
    name,
    symbol,
    issuer,
    dealUrl,
    investmentType,
    investmentCategory,
    payoutFrequency,
    tokenEntityType,
    interestRateBps,
    maturityDate,
    tenorDays,
    decimals,
    bump,
  };
}

// ─── On-Chain RPC Queries ────────────────────────────────────────────────────

/**
 * Fetches and parses the Asset account for a given RWA token mint.
 */
export async function fetchRwaAsset(
  connection: Connection,
  mint: PublicKey | string
): Promise<RwaAssetAccount | null> {
  const mintPk = typeof mint === "string" ? new PublicKey(mint) : mint;
  const [assetPda] = getAssetPda(mintPk);
  const accountInfo = await connection.getAccountInfo(assetPda);
  if (!accountInfo || !accountInfo.data) return null;
  return parseAssetAccount(accountInfo.data);
}

/**
 * Fetches and parses the TokenMeta account for a given RWA token mint.
 */
export async function fetchRwaTokenMeta(
  connection: Connection,
  mint: PublicKey | string
): Promise<RwaTokenMeta | null> {
  const mintPk = typeof mint === "string" ? new PublicKey(mint) : mint;
  const [metaPda] = getTokenMetaPda(mintPk);
  const accountInfo = await connection.getAccountInfo(metaPda);
  if (!accountInfo || !accountInfo.data) return null;
  return parseTokenMetaAccount(accountInfo.data);
}

/**
 * Fetches full market status for an RWA token:
 * Asset config, Token metadata, Vault inventory, and Settlement Token program details.
 */
export async function fetchRwaMarketOverview(
  connection: Connection,
  mint: PublicKey | string
): Promise<RwaMarketOverview | null> {
  const mintPk = typeof mint === "string" ? new PublicKey(mint) : mint;
  const asset = await fetchRwaAsset(connection, mintPk);
  if (!asset) return null;

  const [meta, vaultPda] = await Promise.all([
    fetchRwaTokenMeta(connection, mintPk).catch(() => null),
    Promise.resolve(getVaultPda(mintPk)[0]),
  ]);

  // Determine owner program of the payout mint (SPL Token vs Token-2022)
  const payoutMintInfo = await connection.getAccountInfo(asset.payoutMint);
  const payoutTokenProgram = payoutMintInfo?.owner ?? TOKEN_PROGRAM_ID;

  // Vault ATAs
  const vaultRwaAta = getAssociatedTokenAddressSync(
    mintPk,
    vaultPda,
    true,
    TOKEN_2022_PROGRAM_ID
  );
  const vaultPayoutAta = getAssociatedTokenAddressSync(
    asset.payoutMint,
    vaultPda,
    true,
    payoutTokenProgram
  );

  const [rwaBalanceRes, payoutBalanceRes] = await Promise.all([
    connection.getTokenAccountBalance(vaultRwaAta).catch(() => ({ value: { uiAmountString: "0" } })),
    connection.getTokenAccountBalance(vaultPayoutAta).catch(() => ({ value: { uiAmountString: "0" } })),
  ]);

  const rwaDecimals = meta?.decimals ?? 6;
  const payoutDecimals = 6; // Standard for USDC & cNGN

  return {
    mint: mintPk.toBase58(),
    asset,
    meta,
    vaultRwaBalance: rwaBalanceRes.value.uiAmountString ?? "0",
    vaultPayoutBalance: payoutBalanceRes.value.uiAmountString ?? "0",
    payoutTokenProgram,
    payoutDecimals,
    rwaDecimals,
  };
}

/**
 * Fetches the user's RWA token balance (SPL Token-2022 ATA).
 */
export async function fetchUserRwaHolding(
  connection: Connection,
  trader: PublicKey | string,
  mint: PublicKey | string
): Promise<{ balance: bigint; uiAmount: number; decimals: number }> {
  const traderPk = typeof trader === "string" ? new PublicKey(trader) : trader;
  const mintPk = typeof mint === "string" ? new PublicKey(mint) : mint;

  const traderAta = getAssociatedTokenAddressSync(
    mintPk,
    traderPk,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  try {
    const bal = await connection.getTokenAccountBalance(traderAta);
    const amount = BigInt(bal.value.amount);
    const decimals = bal.value.decimals;
    const uiAmount = bal.value.uiAmount ?? Number(amount) / 10 ** decimals;
    return { balance: amount, uiAmount, decimals };
  } catch {
    return { balance: 0n, uiAmount: 0, decimals: 6 };
  }
}

// ─── Quoting Math ────────────────────────────────────────────────────────────

/**
 * Calculates a Buy quote according to GetEquity trade math:
 *
 * proceeds = amount * price_cents * 10^payout_dec / (100 * 10^rwa_dec)
 * fee = proceeds * fee_bps / 10_000
 * totalCost = proceeds + fee
 * maxCost = totalCost + slippage
 */
export function calculateBuyQuote(params: {
  amount: number | bigint;
  asset: RwaAssetAccount;
  rwaDecimals?: number;
  payoutDecimals?: number;
  slippageBps?: number;
}): BuyQuote {
  const {
    amount,
    asset,
    rwaDecimals = 6,
    payoutDecimals = 6,
    slippageBps = 100, // 1% default slippage guard
  } = params;

  const amountUnits =
    typeof amount === "bigint"
      ? amount
      : BigInt(Math.round(amount * 10 ** rwaDecimals));

  const amountDisplay =
    typeof amount === "number"
      ? amount
      : Number(amountUnits) / 10 ** rwaDecimals;

  const priceCents = asset.priceCents;
  const feeBps = BigInt(asset.feeBps);

  const payoutScale = 10n ** BigInt(payoutDecimals);
  const rwaScale = 10n ** BigInt(rwaDecimals);

  // proceeds = amount * price_cents * 10^payout_dec / (100 * 10^rwa_dec)
  const proceedsUnits = (amountUnits * priceCents * payoutScale) / (100n * rwaScale);

  // fee = proceeds * fee_bps / 10_000
  const feeUnits = (proceedsUnits * feeBps) / 10000n;

  const totalCostUnits = proceedsUnits + feeUnits;

  // Slippage buffer for max_cost
  const slippageAllowance = (totalCostUnits * BigInt(slippageBps)) / 10000n;
  const maxCostUnits = totalCostUnits + slippageAllowance;

  const totalCostUSD = Number(totalCostUnits) / Number(payoutScale);
  const feeUSD = Number(feeUnits) / Number(payoutScale);
  const unitPriceUSD = Number(priceCents) / 100;
  const effectiveRateUSD = amountDisplay > 0 ? totalCostUSD / amountDisplay : unitPriceUSD;

  return {
    amountUnits,
    amountDisplay,
    proceedsUnits,
    feeUnits,
    totalCostUnits,
    maxCostUnits,
    unitPriceUSD,
    totalCostUSD,
    feeUSD,
    slippageBps,
  };
}

/**
 * Calculates a Buy quote given a target payout currency budget (e.g. USDC amount to spend).
 * Derives the maximum amount of RWA shares such that total cost (proceeds + fee) <= target budget.
 */
export function calculateBuyQuoteFromPayoutAmount(params: {
  payoutAmount: number;
  asset: RwaAssetAccount;
  rwaDecimals?: number;
  payoutDecimals?: number;
  slippageBps?: number;
}): BuyQuote {
  const {
    payoutAmount,
    asset,
    rwaDecimals = 6,
    payoutDecimals = 6,
    slippageBps = 100,
  } = params;

  if (payoutAmount <= 0) {
    return calculateBuyQuote({
      amount: 0,
      asset,
      rwaDecimals,
      payoutDecimals,
      slippageBps,
    });
  }

  const payoutScale = 10n ** BigInt(payoutDecimals);
  const rwaScale = 10n ** BigInt(rwaDecimals);
  const targetCostUnits = BigInt(Math.round(payoutAmount * 10 ** payoutDecimals));
  const feeBps = BigInt(asset.feeBps);
  const priceCents = asset.priceCents;

  const numerator = targetCostUnits * 100n * rwaScale * 10000n;
  const denominator = priceCents * payoutScale * (10000n + feeBps);

  if (denominator === 0n) {
    return calculateBuyQuote({
      amount: 0,
      asset,
      rwaDecimals,
      payoutDecimals,
      slippageBps,
    });
  }

  const amountUnits = numerator / denominator;
  return calculateBuyQuote({
    amount: amountUnits,
    asset,
    rwaDecimals,
    payoutDecimals,
    slippageBps,
  });
}

/**
 * Calculates a Sell quote according to GetEquity trade math:
 *
 * proceeds = amount * price_cents * 10^payout_dec / (100 * 10^rwa_dec)
 * fee = proceeds * fee_bps / 10_000
 * netProceeds = proceeds - fee
 * minProceeds = netProceeds - slippage
 */
export function calculateSellQuote(params: {
  amount: number | bigint;
  asset: RwaAssetAccount;
  rwaDecimals?: number;
  payoutDecimals?: number;
  slippageBps?: number;
}): SellQuote {
  const {
    amount,
    asset,
    rwaDecimals = 6,
    payoutDecimals = 6,
    slippageBps = 100, // 1% default
  } = params;

  const amountUnits =
    typeof amount === "bigint"
      ? amount
      : BigInt(Math.round(amount * 10 ** rwaDecimals));

  const amountDisplay =
    typeof amount === "number"
      ? amount
      : Number(amountUnits) / 10 ** rwaDecimals;

  const priceCents = asset.priceCents;
  const feeBps = BigInt(asset.feeBps);

  const payoutScale = 10n ** BigInt(payoutDecimals);
  const rwaScale = 10n ** BigInt(rwaDecimals);

  const proceedsUnits = (amountUnits * priceCents * payoutScale) / (100n * rwaScale);
  const feeUnits = (proceedsUnits * feeBps) / 10000n;
  const netProceedsUnits = proceedsUnits - feeUnits;

  const slippageAllowance = (netProceedsUnits * BigInt(slippageBps)) / 10000n;
  const minProceedsUnits = netProceedsUnits > slippageAllowance ? netProceedsUnits - slippageAllowance : 0n;

  const netProceedsUSD = Number(netProceedsUnits) / Number(payoutScale);
  const feeUSD = Number(feeUnits) / Number(payoutScale);
  const unitPriceUSD = Number(priceCents) / 100;

  return {
    amountUnits,
    amountDisplay,
    proceedsUnits,
    feeUnits,
    netProceedsUnits,
    minProceedsUnits,
    unitPriceUSD,
    netProceedsUSD,
    feeUSD,
    slippageBps,
  };
}

// ─── Instruction Builders ────────────────────────────────────────────────────

/**
 * Builds the raw TransactionInstruction to call `buy` on rwa_market.
 *
 * Accounts layout verified against devnet bytecode:
 * [0] trader (signer, writable)
 * [1] asset PDA (writable: false)
 * [2] rwa_mint (Token-2022)
 * [3] payout_mint
 * [4] vault_rwa_ata (writable)
 * [5] vault_payout_ata (writable)
 * [6] meta PDA
 * [7] trader_rwa_ata (writable)
 * [8] trader_payout_ata (writable)
 * [9] rwa_token_program (Token-2022)
 * [10] payout_token_program
 */
export function createBuyInstruction(params: {
  trader: PublicKey;
  mint: PublicKey;
  asset: RwaAssetAccount;
  amountUnits: bigint;
  maxCostUnits: bigint;
  payoutTokenProgram?: PublicKey;
  hookProgramId?: PublicKey | null;
}): TransactionInstruction {
  const {
    trader,
    mint,
    asset,
    amountUnits,
    maxCostUnits,
    payoutTokenProgram = TOKEN_PROGRAM_ID,
    hookProgramId,
  } = params;

  const [assetPda] = getAssetPda(mint);
  const [metaPda] = getTokenMetaPda(mint);
  const [vaultPda] = getVaultPda(mint);

  const vaultRwaAta = getAssociatedTokenAddressSync(
    mint,
    vaultPda,
    true,
    TOKEN_2022_PROGRAM_ID
  );
  const vaultPayoutAta = getAssociatedTokenAddressSync(
    asset.payoutMint,
    vaultPda,
    true,
    payoutTokenProgram
  );

  const traderRwaAta = getAssociatedTokenAddressSync(
    mint,
    trader,
    false,
    TOKEN_2022_PROGRAM_ID
  );
  const traderPayoutAta = getAssociatedTokenAddressSync(
    asset.payoutMint,
    trader,
    false,
    payoutTokenProgram
  );

  const data = Buffer.alloc(24);
  Buffer.from(BUY_DISCRIMINATOR).copy(data, 0);
  data.writeBigUInt64LE(amountUnits, 8);
  data.writeBigUInt64LE(maxCostUnits, 16);

  const keys = [
    { pubkey: trader, isSigner: true, isWritable: true },
    { pubkey: assetPda, isSigner: false, isWritable: true },
    { pubkey: mint, isSigner: false, isWritable: true },
    { pubkey: asset.payoutMint, isSigner: false, isWritable: true },
    { pubkey: vaultRwaAta, isSigner: false, isWritable: true },
    { pubkey: vaultPayoutAta, isSigner: false, isWritable: true },
    { pubkey: metaPda, isSigner: false, isWritable: true },
    { pubkey: traderRwaAta, isSigner: false, isWritable: true },
    { pubkey: traderPayoutAta, isSigner: false, isWritable: true },
    { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: payoutTokenProgram, isSigner: false, isWritable: false },
  ];

  if (hookProgramId) {
    const [traderClock] = getHolderClockPda(mint, trader, hookProgramId);
    const [vaultClock] = getHolderClockPda(mint, vaultPda, hookProgramId);
    const [extraAccountMetas] = getExtraAccountMetasPda(mint, hookProgramId);

    keys.push(
      { pubkey: traderClock, isSigner: false, isWritable: true },
      { pubkey: vaultClock, isSigner: false, isWritable: true },
      { pubkey: hookProgramId, isSigner: false, isWritable: false },
      { pubkey: extraAccountMetas, isSigner: false, isWritable: false }
    );
  }

  return new TransactionInstruction({
    programId: RWA_MARKET_PROGRAM_ID,
    keys,
    data,
  });
}

/**
 * Builds the raw TransactionInstruction to call `sell` on rwa_market.
 */
export function createSellInstruction(params: {
  trader: PublicKey;
  mint: PublicKey;
  asset: RwaAssetAccount;
  amountUnits: bigint;
  minProceedsUnits: bigint;
  payoutTokenProgram?: PublicKey;
  hookProgramId?: PublicKey | null;
}): TransactionInstruction {
  const {
    trader,
    mint,
    asset,
    amountUnits,
    minProceedsUnits,
    payoutTokenProgram = TOKEN_PROGRAM_ID,
    hookProgramId,
  } = params;

  const [assetPda] = getAssetPda(mint);
  const [metaPda] = getTokenMetaPda(mint);
  const [vaultPda] = getVaultPda(mint);

  const vaultRwaAta = getAssociatedTokenAddressSync(
    mint,
    vaultPda,
    true,
    TOKEN_2022_PROGRAM_ID
  );
  const vaultPayoutAta = getAssociatedTokenAddressSync(
    asset.payoutMint,
    vaultPda,
    true,
    payoutTokenProgram
  );

  const traderRwaAta = getAssociatedTokenAddressSync(
    mint,
    trader,
    false,
    TOKEN_2022_PROGRAM_ID
  );
  const traderPayoutAta = getAssociatedTokenAddressSync(
    asset.payoutMint,
    trader,
    false,
    payoutTokenProgram
  );

  const data = Buffer.alloc(24);
  Buffer.from(SELL_DISCRIMINATOR).copy(data, 0);
  data.writeBigUInt64LE(amountUnits, 8);
  data.writeBigUInt64LE(minProceedsUnits, 16);

  const keys = [
    { pubkey: trader, isSigner: true, isWritable: true },
    { pubkey: assetPda, isSigner: false, isWritable: true },
    { pubkey: mint, isSigner: false, isWritable: true },
    { pubkey: asset.payoutMint, isSigner: false, isWritable: true },
    { pubkey: vaultRwaAta, isSigner: false, isWritable: true },
    { pubkey: vaultPayoutAta, isSigner: false, isWritable: true },
    { pubkey: metaPda, isSigner: false, isWritable: true },
    { pubkey: traderRwaAta, isSigner: false, isWritable: true },
    { pubkey: traderPayoutAta, isSigner: false, isWritable: true },
    { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: payoutTokenProgram, isSigner: false, isWritable: false },
  ];

  if (hookProgramId) {
    const [traderClock] = getHolderClockPda(mint, trader, hookProgramId);
    const [vaultClock] = getHolderClockPda(mint, vaultPda, hookProgramId);
    const [extraAccountMetas] = getExtraAccountMetasPda(mint, hookProgramId);

    keys.push(
      { pubkey: traderClock, isSigner: false, isWritable: true },
      { pubkey: vaultClock, isSigner: false, isWritable: true },
      { pubkey: hookProgramId, isSigner: false, isWritable: false },
      { pubkey: extraAccountMetas, isSigner: false, isWritable: false }
    );
  }

  return new TransactionInstruction({
    programId: RWA_MARKET_PROGRAM_ID,
    keys,
    data,
  });
}

// ─── High-Level Transaction Composers ────────────────────────────────────────

/**
 * Builds a ready-to-sign Transaction for a Buy order:
 * - Checks whether user ATAs for the RWA asset (Token-2022) and Payout token exist.
 * - Adds idempotent ATA creation instructions if necessary.
 * - Adds the `buy` instruction.
 */
export async function buildBuyTransaction(params: {
  connection: Connection;
  trader: PublicKey;
  mint: PublicKey;
  amountUnits: bigint;
  slippageBps?: number;
  payer?: PublicKey;
}): Promise<{ transaction: Transaction; quote: BuyQuote }> {
  const {
    connection,
    trader,
    mint,
    amountUnits,
    slippageBps = 100,
    payer = trader,
  } = params;

  const asset = await fetchRwaAsset(connection, mint);
  if (!asset) {
    throw new Error(`RWA Asset account not found for mint ${mint.toBase58()}`);
  }

  if (!asset.isActive) {
    throw new Error("Asset is currently not active for trading on GetEquity");
  }

  if (asset.maxPerTx > 0n && amountUnits > asset.maxPerTx) {
    throw new Error(`Amount exceeds max per transaction limit (${asset.maxPerTx.toString()})`);
  }

  const payoutMintInfo = await connection.getAccountInfo(asset.payoutMint);
  const payoutTokenProgram = payoutMintInfo?.owner ?? TOKEN_PROGRAM_ID;

  const quote = calculateBuyQuote({
    amount: amountUnits,
    asset,
    slippageBps,
  });

  const traderRwaAta = getAssociatedTokenAddressSync(
    mint,
    trader,
    false,
    TOKEN_2022_PROGRAM_ID
  );
  const traderPayoutAta = getAssociatedTokenAddressSync(
    asset.payoutMint,
    trader,
    false,
    payoutTokenProgram
  );

  const tx = new Transaction();
  tx.feePayer = payer;

  const latestBlockhash = await connection.getLatestBlockhash();
  tx.recentBlockhash = latestBlockhash.blockhash;

  // Invalidate any non-existent ATAs by inserting idempotent creation
  tx.add(
    createAssociatedTokenAccountIdempotentInstruction(
      payer,
      traderRwaAta,
      trader,
      mint,
      TOKEN_2022_PROGRAM_ID
    )
  );

  tx.add(
    createAssociatedTokenAccountIdempotentInstruction(
      payer,
      traderPayoutAta,
      trader,
      asset.payoutMint,
      payoutTokenProgram
    )
  );

  // Detect if mint has a Token-2022 Transfer Hook extension
  let hookProgramId: PublicKey | null = null;
  try {
    const mintInfo = await connection.getAccountInfo(mint);
    if (mintInfo) {
      const unpacked = unpackMint(mint, mintInfo, TOKEN_2022_PROGRAM_ID);
      const hook = getTransferHook(unpacked);
      if (hook?.programId) {
        hookProgramId = hook.programId;
      }
    }
  } catch (err) {
    console.debug("[buildBuyTransaction] Transfer hook check:", err);
  }

  // Add Buy instruction
  tx.add(
    createBuyInstruction({
      trader,
      mint,
      asset,
      amountUnits,
      maxCostUnits: quote.maxCostUnits,
      payoutTokenProgram,
      hookProgramId,
    })
  );

  return { transaction: tx, quote };
}

/**
 * Builds a ready-to-sign Transaction for a Sell order:
 * - Injects idempotent ATA creation for payout currency if not existing.
 * - Adds the `sell` instruction.
 */
export async function buildSellTransaction(params: {
  connection: Connection;
  trader: PublicKey;
  mint: PublicKey;
  amountUnits: bigint;
  slippageBps?: number;
  payer?: PublicKey;
}): Promise<{ transaction: Transaction; quote: SellQuote }> {
  const {
    connection,
    trader,
    mint,
    amountUnits,
    slippageBps = 100,
    payer = trader,
  } = params;

  const asset = await fetchRwaAsset(connection, mint);
  if (!asset) {
    throw new Error(`RWA Asset account not found for mint ${mint.toBase58()}`);
  }

  if (!asset.isActive) {
    throw new Error("Asset is currently not active for trading on GetEquity");
  }

  const payoutMintInfo = await connection.getAccountInfo(asset.payoutMint);
  const payoutTokenProgram = payoutMintInfo?.owner ?? TOKEN_PROGRAM_ID;

  const quote = calculateSellQuote({
    amount: amountUnits,
    asset,
    slippageBps,
  });

  const traderPayoutAta = getAssociatedTokenAddressSync(
    asset.payoutMint,
    trader,
    false,
    payoutTokenProgram
  );

  const tx = new Transaction();
  tx.feePayer = payer;

  const latestBlockhash = await connection.getLatestBlockhash();
  tx.recentBlockhash = latestBlockhash.blockhash;

  // Ensure payout ATA exists
  tx.add(
    createAssociatedTokenAccountIdempotentInstruction(
      payer,
      traderPayoutAta,
      trader,
      asset.payoutMint,
      payoutTokenProgram
    )
  );

  // Detect if mint has a Token-2022 Transfer Hook extension
  let hookProgramId: PublicKey | null = null;
  try {
    const mintInfo = await connection.getAccountInfo(mint);
    if (mintInfo) {
      const unpacked = unpackMint(mint, mintInfo, TOKEN_2022_PROGRAM_ID);
      const hook = getTransferHook(unpacked);
      if (hook?.programId) {
        hookProgramId = hook.programId;
      }
    }
  } catch (err) {
    console.debug("[buildSellTransaction] Transfer hook check:", err);
  }

  // Add Sell instruction
  tx.add(
    createSellInstruction({
      trader,
      mint,
      asset,
      amountUnits,
      minProceedsUnits: quote.minProceedsUnits,
      payoutTokenProgram,
      hookProgramId,
    })
  );

  return { transaction: tx, quote };
}

// ─── Jupiter Swap Integration for RWA (USDC -> cNGN -> Asset) ─────────────────

export interface JupiterQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee: unknown;
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
  contextSlot?: number;
  timeTaken?: number;
}

export interface JupiterInstructionAccount {
  pubkey: string;
  isSigner: boolean;
  isWritable: boolean;
}

export interface JupiterInstruction {
  programId: string;
  accounts: JupiterInstructionAccount[];
  data: string; // base64 encoded
}

export interface JupiterSwapInstructionsResponse {
  tokenLedgerInstruction?: JupiterInstruction | null;
  computeBudgetInstructions?: JupiterInstruction[];
  setupInstructions?: JupiterInstruction[];
  swapInstruction: JupiterInstruction;
  cleanupInstruction?: JupiterInstruction | null;
  addressLookupTableAddresses?: string[];
  prioritizationFeeLamports?: number;
  computeUnitLimit?: number;
}

export function getJupiterApiKey(): string {
  const envKey = (import.meta.env.VITE_JUP_API_KEY as string | undefined)?.trim();
  return envKey || "7533d7b5-93c3-43ed-942e-08a8142c2dd4";
}

export function deserializeJupiterInstruction(ix: JupiterInstruction): TransactionInstruction {
  return new TransactionInstruction({
    programId: new PublicKey(ix.programId),
    keys: ix.accounts.map((acc) => ({
      pubkey: new PublicKey(acc.pubkey),
      isSigner: acc.isSigner,
      isWritable: acc.isWritable,
    })),
    data: Buffer.from(ix.data, "base64"),
  });
}

/**
 * Queries the Jupiter Swap Quote API for token routing (e.g. USDC -> cNGN).
 */
export async function fetchJupiterQuote(params: {
  inputMint: string;
  outputMint: string;
  amountUnits: string | number | bigint;
  slippageBps?: number;
}): Promise<JupiterQuoteResponse> {
  const { inputMint, outputMint, amountUnits, slippageBps = 50 } = params;
  const apiKey = getJupiterApiKey();
  const url = `https://api.jup.ag/swap/v1/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountUnits.toString()}&slippageBps=${slippageBps}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "x-api-key": apiKey,
    },
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`Jupiter quote error (${res.status}): ${errorText || res.statusText}`);
  }

  return (await res.json()) as JupiterQuoteResponse;
}

/**
 * Requests raw serialized instructions from Jupiter Swap Instructions API.
 */
export async function fetchJupiterSwapInstructions(params: {
  quoteResponse: JupiterQuoteResponse;
  userPublicKey: string;
  wrapAndUnwrapSol?: boolean;
}): Promise<JupiterSwapInstructionsResponse> {
  const { quoteResponse, userPublicKey, wrapAndUnwrapSol = false } = params;
  const apiKey = getJupiterApiKey();
  const url = "https://api.jup.ag/swap/v1/swap-instructions";

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      quoteResponse,
      userPublicKey,
      wrapAndUnwrapSol,
      useSharedAccounts: false,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`Jupiter swap instructions error (${res.status}): ${errorText || res.statusText}`);
  }

  return (await res.json()) as JupiterSwapInstructionsResponse;
}

/**
 * Fetches the live exchange rate between USDC and cNGN via Jupiter / Orca Whirlpool.
 */
export async function fetchJupiterExchangeRate(
  inputMint: string = KNOWN_PAYOUT_MINTS.mainnet.USDC,
  outputMint: string = KNOWN_PAYOUT_MINTS.mainnet.CNGN
): Promise<{ rate: number; priceImpactPct: number }> {
  try {
    const quote = await fetchJupiterQuote({
      inputMint,
      outputMint,
      amountUnits: 1_000_000, // 1 USDC
      slippageBps: 50,
    });
    const rate = Number(quote.outAmount) / 1e6;
    const priceImpactPct = parseFloat(quote.priceImpactPct) || 0;
    return { rate, priceImpactPct };
  } catch (err) {
    console.error("[fetchJupiterExchangeRate] Failed:", err);
    return { rate: 1368.95, priceImpactPct: 0 };
  }
}

/**
 * Builds an atomic VersionedTransaction combining:
 * 1. Jupiter Swap Instructions (USDC -> cNGN via Orca Whirlpool)
 * 2. Idempotent ATA creation for trader's DPRI (Token-2022)
 * 3. GetEquity Buy Instruction (cNGN -> DPRI)
 *
 * All packed into a single transaction signed once by the user.
 */
export async function buildSwapAndBuyTransaction(params: {
  connection: Connection;
  trader: PublicKey;
  mint: PublicKey;
  spendMode: "usdc" | "shares";
  inputValue: number;
  slippageBps?: number;
  payer?: PublicKey;
}): Promise<{
  versionedTransaction: VersionedTransaction;
  jupQuote: JupiterQuoteResponse;
  buyQuote: BuyQuote;
  estimatedUsdcCost: number;
  estimatedShares: number;
  cngnProceeds: number;
}> {
  const {
    connection,
    trader,
    mint,
    spendMode,
    inputValue,
    slippageBps = 100,
    payer = trader,
  } = params;

  const asset = await fetchRwaAsset(connection, mint);
  if (!asset) {
    throw new Error(`RWA Asset account not found for mint ${mint.toBase58()}`);
  }

  if (!asset.isActive) {
    throw new Error("Asset is currently not active for trading on GetEquity");
  }

  const payoutMintInfo = await connection.getAccountInfo(asset.payoutMint);
  const payoutTokenProgram = payoutMintInfo?.owner ?? TOKEN_PROGRAM_ID;

  const usdcMint = KNOWN_PAYOUT_MINTS.mainnet.USDC;
  const cngnMint = asset.payoutMint.toBase58();

  let jupQuote: JupiterQuoteResponse;
  let buyQuote: BuyQuote;
  let estimatedUsdcCost = 0;

  if (spendMode === "usdc") {
    // User wants to spend a fixed amount of USDC
    const usdcUnits = BigInt(Math.round(inputValue * 1e6));
    if (usdcUnits <= 0n) {
      throw new Error("Invalid USDC amount");
    }

    jupQuote = await fetchJupiterQuote({
      inputMint: usdcMint,
      outputMint: cngnMint,
      amountUnits: usdcUnits,
      slippageBps,
    });

    const minCngnUnits = BigInt(jupQuote.otherAmountThreshold || jupQuote.outAmount);
    const minCngnDisplay = Number(minCngnUnits) / 1e6;

    buyQuote = calculateBuyQuoteFromPayoutAmount({
      payoutAmount: minCngnDisplay,
      asset,
      rwaDecimals: 6,
      payoutDecimals: 6,
      slippageBps,
    });

    if (buyQuote.amountUnits <= 0n) {
      throw new Error("USDC amount is too small to purchase any DPRI shares");
    }

    estimatedUsdcCost = inputValue;
  } else {
    // User wants to buy a specific number of DPRI shares
    buyQuote = calculateBuyQuote({
      amount: inputValue,
      asset,
      rwaDecimals: 6,
      payoutDecimals: 6,
      slippageBps,
    });

    if (buyQuote.amountUnits <= 0n) {
      throw new Error("Invalid shares amount");
    }

    // Probe quote to get the live exchange rate
    const probeQuote = await fetchJupiterQuote({
      inputMint: usdcMint,
      outputMint: cngnMint,
      amountUnits: 1_000_000, // 1 USDC
      slippageBps,
    });

    const probeOutUnits = Number(probeQuote.outAmount);
    if (probeOutUnits <= 0) {
      throw new Error("Failed to get cNGN exchange rate from Jupiter");
    }

    // Calculate required USDC with 0.8% buffer to guarantee otherAmountThreshold >= maxCostUnits
    const targetCngnUnits = Number(buyQuote.maxCostUnits);
    let estimatedUsdcUnits = Math.ceil((targetCngnUnits / probeOutUnits) * 1_000_000 * 1.008);

    jupQuote = await fetchJupiterQuote({
      inputMint: usdcMint,
      outputMint: cngnMint,
      amountUnits: estimatedUsdcUnits,
      slippageBps,
    });

    // If min output threshold is slightly below target cost, bump by 1%
    if (BigInt(jupQuote.otherAmountThreshold) < buyQuote.maxCostUnits) {
      estimatedUsdcUnits = Math.ceil(estimatedUsdcUnits * 1.015);
      jupQuote = await fetchJupiterQuote({
        inputMint: usdcMint,
        outputMint: cngnMint,
        amountUnits: estimatedUsdcUnits,
        slippageBps,
      });
    }

    estimatedUsdcCost = Number(jupQuote.inAmount) / 1e6;
  }

  // Request swap instructions from Jupiter
  const swapIxs = await fetchJupiterSwapInstructions({
    quoteResponse: jupQuote,
    userPublicKey: trader.toBase58(),
    wrapAndUnwrapSol: false,
  });

  // Resolve Address Lookup Tables
  const altAccounts: AddressLookupTableAccount[] = [];
  if (swapIxs.addressLookupTableAddresses && swapIxs.addressLookupTableAddresses.length > 0) {
    for (const altAddr of swapIxs.addressLookupTableAddresses) {
      try {
        const altRes = await connection.getAddressLookupTable(new PublicKey(altAddr));
        if (altRes.value) {
          altAccounts.push(altRes.value);
        }
      } catch (err) {
        console.warn("[buildSwapAndBuyTransaction] ALT resolution error:", altAddr, err);
      }
    }
  }

  // Detect Token-2022 Transfer Hook extension for DPRI
  let hookProgramId: PublicKey | null = null;
  try {
    const mintInfo = await connection.getAccountInfo(mint);
    if (mintInfo) {
      const unpacked = unpackMint(mint, mintInfo, TOKEN_2022_PROGRAM_ID);
      const hook = getTransferHook(unpacked);
      if (hook?.programId) {
        hookProgramId = hook.programId;
      }
    }
  } catch (err) {
    console.debug("[buildSwapAndBuyTransaction] Transfer hook check:", err);
  }

  // Assemble instructions in order
  const instructions: TransactionInstruction[] = [];

  // 1. Compute Budget
  if (swapIxs.computeBudgetInstructions) {
    for (const ix of swapIxs.computeBudgetInstructions) {
      instructions.push(deserializeJupiterInstruction(ix));
    }
  }

  // 2. Setup (creates cNGN ATA if not exists)
  if (swapIxs.setupInstructions) {
    for (const ix of swapIxs.setupInstructions) {
      instructions.push(deserializeJupiterInstruction(ix));
    }
  }

  // 3. Jupiter Swap (USDC -> cNGN)
  if (swapIxs.swapInstruction) {
    instructions.push(deserializeJupiterInstruction(swapIxs.swapInstruction));
  }

  // 4. Idempotent create trader DPRI ATA (Token-2022)
  const traderRwaAta = getAssociatedTokenAddressSync(
    mint,
    trader,
    false,
    TOKEN_2022_PROGRAM_ID
  );
  instructions.push(
    createAssociatedTokenAccountIdempotentInstruction(
      payer,
      traderRwaAta,
      trader,
      mint,
      TOKEN_2022_PROGRAM_ID
    )
  );

  // 5. GetEquity Buy instruction (cNGN -> DPRI)
  instructions.push(
    createBuyInstruction({
      trader,
      mint,
      asset,
      amountUnits: buyQuote.amountUnits,
      maxCostUnits: buyQuote.maxCostUnits,
      payoutTokenProgram,
      hookProgramId,
    })
  );

  // 6. Cleanup (if any)
  if (swapIxs.cleanupInstruction) {
    instructions.push(deserializeJupiterInstruction(swapIxs.cleanupInstruction));
  }

  // Build TransactionMessage v0 with Address Lookup Tables
  const latestBlockhash = await connection.getLatestBlockhash("confirmed");
  const messageV0 = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: latestBlockhash.blockhash,
    instructions,
  }).compileToV0Message(altAccounts);

  const versionedTransaction = new VersionedTransaction(messageV0);

  return {
    versionedTransaction,
    jupQuote,
    buyQuote,
    estimatedUsdcCost,
    estimatedShares: buyQuote.amountDisplay,
    cngnProceeds: Number(jupQuote.outAmount) / 1e6,
  };
}

