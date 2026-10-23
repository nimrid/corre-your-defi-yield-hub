/**
 * Corre Piggy Bank — TypeScript Client
 *
 * Provides helpers for:
 *   - Deriving PDA addresses
 *   - Building initialize / deposit / release / emergency_withdraw instructions
 *   - Reading on-chain vault balance
 *
 * All instructions follow the 1-byte discriminator layout defined in lib.rs.
 * This client uses pure @solana/web3.js with no Anchor dependency.
 */

import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  AccountMeta,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAccount,
} from "@solana/spl-token";

// ── Constants ────────────────────────────────────────────────────────────────

/**
 * Replace with actual program ID after first `solana program deploy`.
 * Run: `solana program deploy target/deploy/piggybank.so --url devnet`
 * and paste the output "Program Id" here.
 */
export const PIGGYBANK_PROGRAM_ID = new PublicKey(
  process.env.PIGGYBANK_PROGRAM_ID ||
    "E7qVrKjegAoaw9CY5xck1sRHuHPX1SXZ1c5SJwycSnJL"
);

/** Devnet USDC mint (Circle devnet faucet) */
export const USDC_MINT_DEVNET = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
);

/** Mainnet USDC mint */
export const USDC_MINT_MAINNET = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
);

/** Corre authority (devnet throwaway) — must match CORRE_AUTHORITY in lib.rs */
export const CORRE_AUTHORITY = new PublicKey(
  "3dpSWyNJFLMj1957pLaB3xVYHETopVvQa6NjAARWg3mj"
);

/** PDA seed prefix — must match PIGGYBANK_SEED in state.rs */
const PIGGYBANK_SEED = Buffer.from("piggybank");

/** Instruction discriminators — must match disc:: in lib.rs */
export const DISC = {
  INITIALIZE: 0x00,
  DEPOSIT: 0x01,
  RELEASE: 0x02,
  EMERGENCY_WITHDRAW: 0x03,
} as const;

// ── PDA Derivation ───────────────────────────────────────────────────────────

/**
 * Derives the Piggy Bank PDA address for a given owner + stock mint.
 * Seeds: ["piggybank", owner_pubkey, stock_mint_pubkey]
 */
export async function derivePiggyBankPda(
  owner: PublicKey,
  stockMint: PublicKey
): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddress(
    [PIGGYBANK_SEED, owner.toBuffer(), stockMint.toBuffer()],
    PIGGYBANK_PROGRAM_ID
  );
}

/**
 * Derives the USDC vault ATA for the piggy bank PDA.
 * This account's authority is the PDA, so only the program can move funds out.
 */
export async function deriveVaultAta(
  owner: PublicKey,
  stockMint: PublicKey,
  usdcMint: PublicKey
): Promise<{ pda: PublicKey; bump: number; vaultAta: PublicKey }> {
  const [pda, bump] = await derivePiggyBankPda(owner, stockMint);
  const vaultAta = await getAssociatedTokenAddress(
    usdcMint,
    pda,
    true // allowOwnerOffCurve = true because PDA is off-curve
  );
  return { pda, bump, vaultAta };
}

// ── Instruction Builders ─────────────────────────────────────────────────────

/**
 * Builds the full set of instructions needed to set up a new piggy bank vault:
 *   1. Create vault USDC ATA (if it doesn't exist)
 *   2. Initialize PDA state
 *
 * @param connection     - Solana RPC connection
 * @param payer          - Fee payer (usually == owner for UX simplicity)
 * @param owner          - User's wallet public key
 * @param stockMint      - Target tokenized stock SPL mint
 * @param usdcMint       - USDC mint (devnet or mainnet)
 * @param thresholdUsdc  - Vault release threshold in USDC lamports (6dp). Default $5 = 5_000_000
 */
export async function buildInitializeInstructions(
  connection: Connection,
  payer: PublicKey,
  owner: PublicKey,
  stockMint: PublicKey,
  usdcMint: PublicKey,
  thresholdUsdc: bigint = 5_000_000n
): Promise<{ instructions: TransactionInstruction[]; pda: PublicKey; vaultAta: PublicKey; bump: number }> {
  const { pda, bump, vaultAta } = await deriveVaultAta(owner, stockMint, usdcMint);
  const instructions: TransactionInstruction[] = [];

  // 1. Create vault ATA if it doesn't exist yet
  try {
    await getAccount(connection, vaultAta);
    // ATA already exists — skip creation
  } catch {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        payer,           // fee payer
        vaultAta,        // ATA to create
        pda,             // ATA owner (the PDA)
        usdcMint,        // mint
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
  }

  // 2. Calculate rent for PDA state (112 bytes)
  const STATE_SIZE = 112;
  const lamports = await connection.getMinimumBalanceForRentExemption(STATE_SIZE);

  // 3. Build initialize instruction data: [lamports: u64le, threshold: u64le, bump: u8]
  const data = Buffer.allocUnsafe(1 + 8 + 8 + 1);
  data.writeUInt8(DISC.INITIALIZE, 0);
  data.writeBigUInt64LE(BigInt(lamports), 1);
  data.writeBigUInt64LE(thresholdUsdc, 9);
  data.writeUInt8(bump, 17);

  const initIx = new TransactionInstruction({
    programId: PIGGYBANK_PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },           // 0. payer
      { pubkey: owner, isSigner: true, isWritable: false },           // 1. owner
      { pubkey: pda, isSigner: false, isWritable: true },             // 2. pda_state
      { pubkey: vaultAta, isSigner: false, isWritable: false },       // 3. usdc_vault
      { pubkey: stockMint, isSigner: false, isWritable: false },      // 4. stock_mint
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // 5. system_program
    ],
    data,
  });

  instructions.push(initIx);
  return { instructions, pda, vaultAta, bump };
}

/**
 * Builds a Deposit instruction.
 * Transfers USDC from the owner's main ATA into the vault.
 *
 * @param owner          - User wallet public key (signer)
 * @param ownerUsdcAta   - User's main USDC ATA (source)
 * @param vaultAta       - Vault USDC ATA (destination)
 * @param pda            - PDA state account
 * @param amountUsdc     - Amount in USDC lamports (6dp: 1_000_000 = $1.00)
 */
export function buildDepositInstruction(
  owner: PublicKey,
  ownerUsdcAta: PublicKey,
  vaultAta: PublicKey,
  pda: PublicKey,
  amountUsdc: bigint
): TransactionInstruction {
  const data = Buffer.allocUnsafe(1 + 8);
  data.writeUInt8(DISC.DEPOSIT, 0);
  data.writeBigUInt64LE(amountUsdc, 1);

  return new TransactionInstruction({
    programId: PIGGYBANK_PROGRAM_ID,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: false },           // 0. owner
      { pubkey: ownerUsdcAta, isSigner: false, isWritable: true },    // 1. owner_usdc_ata
      { pubkey: vaultAta, isSigner: false, isWritable: true },        // 2. vault_usdc_ata
      { pubkey: pda, isSigner: false, isWritable: false },            // 3. pda_state
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },// 4. token_program
    ],
    data,
  });
}

/**
 * Builds a Release instruction.
 * Transfers all vault USDC → recipient USDC ATA once threshold is met.
 * Called by the Inngest worker using the Corre authority keypair or the user's Privy wallet.
 *
 * @param authority         - Signer: either owner OR CORRE_AUTHORITY
 * @param pda               - PDA state account
 * @param vaultAta          - Vault USDC ATA (source)
 * @param recipientUsdcAta  - Destination USDC ATA (typically user's main wallet ATA)
 */
export function buildReleaseInstruction(
  authority: PublicKey,
  pda: PublicKey,
  vaultAta: PublicKey,
  recipientUsdcAta: PublicKey
): TransactionInstruction {
  const data = Buffer.alloc(1);
  data.writeUInt8(DISC.RELEASE, 0);

  return new TransactionInstruction({
    programId: PIGGYBANK_PROGRAM_ID,
    keys: [
      { pubkey: authority, isSigner: true, isWritable: false },        // 0. authority
      { pubkey: pda, isSigner: false, isWritable: true },              // 1. pda_state
      { pubkey: vaultAta, isSigner: false, isWritable: true },         // 2. vault_usdc_ata
      { pubkey: recipientUsdcAta, isSigner: false, isWritable: true }, // 3. recipient_usdc_ata
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },// 4. token_program
    ],
    data,
  });
}

/**
 * Builds an EmergencyWithdraw instruction.
 * Owner reclaims all USDC and closes the vault. No threshold required.
 *
 * @param owner          - Vault owner (signer)
 * @param pda            - PDA state account (will be closed)
 * @param vaultAta       - Vault USDC ATA (source)
 * @param ownerUsdcAta   - Owner's main USDC ATA (destination)
 */
export function buildEmergencyWithdrawInstruction(
  owner: PublicKey,
  pda: PublicKey,
  vaultAta: PublicKey,
  ownerUsdcAta: PublicKey
): TransactionInstruction {
  const data = Buffer.alloc(1);
  data.writeUInt8(DISC.EMERGENCY_WITHDRAW, 0);

  return new TransactionInstruction({
    programId: PIGGYBANK_PROGRAM_ID,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },            // 0. owner
      { pubkey: pda, isSigner: false, isWritable: true },             // 1. pda_state
      { pubkey: vaultAta, isSigner: false, isWritable: true },        // 2. vault_usdc_ata
      { pubkey: ownerUsdcAta, isSigner: false, isWritable: true },    // 3. owner_usdc_ata
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },// 4. token_program
    ],
    data,
  });
}

// ── Vault State Readers ──────────────────────────────────────────────────────

/**
 * Reads the current USDC balance held in the vault token account.
 * Returns 0 if the account does not exist yet.
 */
export async function getVaultBalance(
  connection: Connection,
  vaultAta: PublicKey
): Promise<{ balanceLamports: bigint; balanceUsd: number }> {
  try {
    const account = await getAccount(connection, vaultAta);
    const balanceLamports = account.amount;
    const balanceUsd = Number(balanceLamports) / 1_000_000; // USDC has 6 decimals
    return { balanceLamports, balanceUsd };
  } catch {
    return { balanceLamports: 0n, balanceUsd: 0 };
  }
}

/**
 * Reads and decodes the on-chain PiggyBankState for a given owner + stock mint.
 * Returns null if the PDA doesn't exist (vault not initialized).
 */
export async function getPiggyBankState(
  connection: Connection,
  owner: PublicKey,
  stockMint: PublicKey
): Promise<{
  pda: PublicKey;
  vaultAta: PublicKey;
  thresholdUsd: number;
  bump: number;
} | null> {
  const [pda] = await derivePiggyBankPda(owner, stockMint);
  const account = await connection.getAccountInfo(pda);
  if (!account || account.data.length < 112) return null;

  const data = account.data;
  const thresholdBytes = data.readBigUInt64LE(0);
  const vaultAtaBytes = data.slice(72, 104);
  const bump = data[105];

  return {
    pda,
    vaultAta: new PublicKey(vaultAtaBytes),
    thresholdUsd: Number(thresholdBytes) / 1_000_000,
    bump,
  };
}
