/**
 * Check & Fix Jupiter Referral Account
 *
 * Usage:
 *   node scripts/check-referral.mjs check
 *   node scripts/check-referral.mjs create <BASE58_PRIVATE_KEY>
 *
 * "check"  — reads the existing referral account on-chain and shows which project it belongs to.
 * "create" — creates a NEW referral account linked to the correct project.
 */

import { Connection, PublicKey, Keypair, sendAndConfirmTransaction, sendAndConfirmRawTransaction } from "@solana/web3.js";
import { ReferralProvider } from "@jup-ag/referral-sdk";

// ─── Constants ──────────────────────────────────────────────────────────────
const REFERRAL_PROGRAM_ID = new PublicKey("REFER4ZgmyYx9c6He5XfaTMiGfdLwRnkV4RPp9t9iF3");
const TARGET_PROJECT      = new PublicKey("DkiqsTrw1u1bYFumumC7sCG2S8K25qc2vemJFHyW2wJc");
const EXISTING_REFERRAL   = new PublicKey("5VAt8EHw6jQuSC3X2ezTZDmF9pfLrLnoZLbVwMP7B8Ga");

// USDC mint on mainnet
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

// ─── Check ──────────────────────────────────────────────────────────────────
async function checkExistingAccount() {
  const connection = new Connection(RPC_URL, "confirmed");

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Checking existing referral account");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  Account:  ${EXISTING_REFERRAL.toBase58()}`);
  console.log(`  Expected project: ${TARGET_PROJECT.toBase58()}`);
  console.log("");

  const accountInfo = await connection.getAccountInfo(EXISTING_REFERRAL);

  if (!accountInfo) {
    console.log("❌ Account does NOT exist on-chain.");
    return;
  }

  console.log(`✅ Account exists on-chain`);
  console.log(`   Owner program: ${accountInfo.owner.toBase58()}`);
  console.log(`   Data length:   ${accountInfo.data.length} bytes`);
  console.log(`   Lamports:      ${accountInfo.lamports}`);

  if (!accountInfo.owner.equals(REFERRAL_PROGRAM_ID)) {
    console.log(`\n⚠️  Owner is NOT the Referral Program!`);
    console.log(`   Expected: ${REFERRAL_PROGRAM_ID.toBase58()}`);
    console.log(`   Got:      ${accountInfo.owner.toBase58()}`);
    return;
  }

  // Referral account data layout (Anchor):
  // Offset 8:  partner (32 bytes)
  // Offset 40: project (32 bytes)
  if (accountInfo.data.length >= 72) {
    const partnerBytes = accountInfo.data.slice(8, 40);
    const projectBytes = accountInfo.data.slice(40, 72);
    const partner = new PublicKey(partnerBytes);
    const project = new PublicKey(projectBytes);

    console.log(`\n   Partner (creator): ${partner.toBase58()}`);
    console.log(`   Project:           ${project.toBase58()}`);

    if (project.equals(TARGET_PROJECT)) {
      console.log(`\n✅ This referral account IS linked to the correct project!`);
    } else {
      console.log(`\n❌ MISMATCH — This referral account is linked to a DIFFERENT project.`);
      console.log(`   Expected: ${TARGET_PROJECT.toBase58()}`);
      console.log(`   Got:      ${project.toBase58()}`);
      console.log(`\n   → You need to create a NEW referral account under the correct project.`);
      console.log(`   → Run: node scripts/check-referral.mjs create <YOUR_BASE58_PRIVATE_KEY>`);
    }
  } else {
    console.log(`\n⚠️  Account data is too short to parse (${accountInfo.data.length} bytes).`);
  }
}

// ─── Create ─────────────────────────────────────────────────────────────────
async function createNewReferralAccount(privateKeyBase58) {
  const connection = new Connection(RPC_URL, "confirmed");

  // Decode private key
  let secretKey;
  try {
    const parsed = JSON.parse(privateKeyBase58);
    secretKey = Uint8Array.from(parsed);
  } catch {
    const { default: bs58 } = await import("bs58");
    secretKey = bs58.decode(privateKeyBase58);
  }

  const wallet = Keypair.fromSecretKey(secretKey);
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Creating new referral account");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  Wallet:  ${wallet.publicKey.toBase58()}`);
  console.log(`  Project: ${TARGET_PROJECT.toBase58()}`);
  console.log("");

  const provider = new ReferralProvider(connection);

  // Use initializeReferralAccountWithName — it auto-derives the PDA
  // and returns { tx, referralAccountPubKey }
  const name = "corre-defi-" + Date.now().toString(36);
  console.log(`Step 1: Initializing referral account with name "${name}"...`);

  const { tx: initTx, referralAccountPubKey } = await provider.initializeReferralAccountWithName({
    payerPubKey: wallet.publicKey,
    partnerPubKey: wallet.publicKey,
    projectPubKey: TARGET_PROJECT,
    name,
  });

  const initSig = await sendAndConfirmTransaction(connection, initTx, [wallet]);
  console.log(`✅ Referral account created: ${referralAccountPubKey.toBase58()}`);
  console.log(`   Transaction: ${initSig}`);

  // Step 2: Initialize USDC token account for fee collection
  console.log("\nStep 2: Initializing USDC referral token account...");
  const { tx: tokenTx, referralTokenAccountPubKey } = await provider.initializeReferralTokenAccount({
    payerPubKey: wallet.publicKey,
    referralAccountPubKey,
    mint: USDC_MINT,
  });

  const tokenSig = await sendAndConfirmTransaction(connection, tokenTx, [wallet]);
  console.log(`✅ USDC token account created: ${referralTokenAccountPubKey.toBase58()}`);
  console.log(`   Transaction: ${tokenSig}`);

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  DONE! Update your code with the new referral account:");
  console.log("");
  console.log(`  referralAccount: "${referralAccountPubKey.toBase58()}"`);
  console.log("");
  console.log("═══════════════════════════════════════════════════════════");
}

// ─── Claim ──────────────────────────────────────────────────────────────────
async function claimAllFees(privateKeyBase58) {
  const connection = new Connection(RPC_URL, "confirmed");

  // Decode private key
  let secretKey;
  try {
    const parsed = JSON.parse(privateKeyBase58);
    secretKey = Uint8Array.from(parsed);
  } catch {
    const { default: bs58 } = await import("bs58");
    secretKey = bs58.decode(privateKeyBase58);
  }

  const wallet = Keypair.fromSecretKey(secretKey);
  const provider = new ReferralProvider(connection);

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Claiming all referral fees");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  Wallet (partner):   ${wallet.publicKey.toBase58()}`);
  console.log(`  Referral account:   ${EXISTING_REFERRAL.toBase58()}`);
  console.log("");

  // Step 1: Check what token accounts have accumulated fees
  console.log("Step 1: Fetching referral token accounts...");
  let tokenAccounts, token2022Accounts;
  try {
    const result = await provider.getReferralTokenAccountsV2(
      EXISTING_REFERRAL.toBase58(),
    );
    tokenAccounts = result.tokenAccounts;
    token2022Accounts = result.token2022Accounts;
  } catch (err) {
    console.log("  getReferralTokenAccountsV2 not available, trying getReferralTokenAccounts...");
    const result = await provider.getReferralTokenAccounts(
      EXISTING_REFERRAL.toBase58(),
    );
    tokenAccounts = result.tokenAccounts;
    token2022Accounts = result.token2022Accounts;
  }

  const allAccounts = [
    ...(tokenAccounts || []),
    ...(token2022Accounts || []),
  ];

  const withdrawable = allAccounts.filter(
    (t) => t.account.amount > 0n && t.account.state === 1,
  );

  if (withdrawable.length === 0) {
    console.log("\n✅ No fees to claim — all referral token accounts are empty.");
    return;
  }

  console.log(`\n  Found ${withdrawable.length} token account(s) with claimable fees:`);
  for (const t of withdrawable) {
    console.log(`    Mint: ${t.account.mint.toBase58()}  Amount: ${t.account.amount.toString()}`);
  }

  // Step 2: Build claim transactions
  console.log("\nStep 2: Building claim transactions...");
  let txs;
  try {
    txs = await provider.claimAllV2({
      payerPubKey: wallet.publicKey,
      referralAccountPubKey: EXISTING_REFERRAL,
    });
  } catch (err) {
    console.log("  claimAllV2 not available, trying claimAll...");
    txs = await provider.claimAll({
      payerPubKey: wallet.publicKey,
      referralAccountPubKey: EXISTING_REFERRAL,
    });
  }

  if (!txs || txs.length === 0) {
    console.log("\n⚠️  No claim transactions were generated.");
    return;
  }

  console.log(`  Generated ${txs.length} claim transaction(s).`);

  // Step 3: Sign and send each transaction
  console.log("\nStep 3: Signing and sending transactions...");
  let successCount = 0;
  for (let i = 0; i < txs.length; i++) {
    const tx = txs[i];
    try {
      tx.sign([wallet]);
      const sig = await sendAndConfirmRawTransaction(
        connection,
        Buffer.from(tx.serialize()),
        { commitment: "confirmed" },
      );
      console.log(`  ✅ TX ${i + 1}/${txs.length}: https://solscan.io/tx/${sig}`);
      successCount++;
    } catch (err) {
      console.error(`  ❌ TX ${i + 1}/${txs.length} failed: ${err.message}`);
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log(`  Done! ${successCount}/${txs.length} transactions confirmed.`);
  console.log("═══════════════════════════════════════════════════════════");
}

// ─── CLI ────────────────────────────────────────────────────────────────────
const [,, command, arg] = process.argv;

if (command === "check") {
  checkExistingAccount().catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
  });
} else if (command === "create") {
  if (!arg) {
    console.error("Usage: node scripts/check-referral.mjs create <BASE58_PRIVATE_KEY>");
    process.exit(1);
  }
  createNewReferralAccount(arg).catch((err) => {
    console.error("Error:", err.message ?? err);
    process.exit(1);
  });
} else if (command === "claim") {
  if (!arg) {
    console.error("Usage: node scripts/check-referral.mjs claim <BASE58_PRIVATE_KEY>");
    process.exit(1);
  }
  claimAllFees(arg).catch((err) => {
    console.error("Error:", err.message ?? err);
    process.exit(1);
  });
} else {
  console.log("Jupiter Referral Account Tool");
  console.log("");
  console.log("Commands:");
  console.log("  check                        — Inspect the existing referral account on-chain");
  console.log("  create <BASE58_PRIVATE_KEY>   — Create a new referral account under the correct project");
  console.log("  claim  <BASE58_PRIVATE_KEY>   — Claim all accumulated referral fees");
  console.log("");
  console.log("Environment:");
  console.log("  SOLANA_RPC_URL  — RPC endpoint (default: mainnet-beta)");
}
