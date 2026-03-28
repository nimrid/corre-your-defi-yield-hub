import { z } from "zod";

// ── User schemas ──────────────────────────────────────────────────────────────

export const WalletInputSchema = z.object({
  address: z.string().min(1, "Wallet address is required"),
  chainType: z.enum(["solana", "ethereum"] as const, {
    error: 'chainType must be "solana" or "ethereum"',
  }),
  isLinked: z.boolean().optional(),
});

export const UpsertUserSchema = z.object({
  privyUserId: z.string().min(1, "privyUserId is required"),
  email: z.string().email("Invalid email").nullable().optional(),
  name: z.string().max(200).nullable().optional(),
  wallets: z.array(WalletInputSchema).default([]),
  referredByCode: z.string().max(20).nullable().optional(),
});

// ── Transaction schemas ───────────────────────────────────────────────────────

export const CreateTransactionSchema = z.object({
  privyUserId: z.string().min(1, "privyUserId is required"),
  chainType: z.string().min(1, "chainType is required"),
  assetSymbol: z.string().min(1, "assetSymbol is required"),
  amount: z.string().min(1, "amount is required"),
  direction: z.enum(["incoming", "outgoing"] as const, {
    error: 'direction must be "incoming" or "outgoing"',
  }),
  txSignature: z.string().nullable().optional(),
  fromAddress: z.string().min(1, "fromAddress is required"),
  toAddress: z.string().min(1, "toAddress is required"),
  source: z.string().nullable().optional(),
});

// ── Savings schemas ───────────────────────────────────────────────────────────

export const CreateSavingsSchema = z.object({
  privyUserId: z.string().min(1, "privyUserId is required"),
  vaultType: z.enum(["regular", "protected"] as const, {
    error: 'vaultType must be "regular" or "protected"',
  }),
  direction: z.enum(["deposit", "withdrawal"] as const, {
    error: 'direction must be "deposit" or "withdrawal"',
  }),
  usdcAmount: z
    .string()
    .min(1, "usdcAmount is required")
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, {
      message: "usdcAmount must be a positive number string",
    }),
  walletAddress: z.string().nullable().optional(),
  txSignature: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
});

// ── Stock schemas ─────────────────────────────────────────────────────────────

export const StockTradeSchema = z.object({
  privyUserId: z.string().min(1, "privyUserId is required"),
  stockMint: z.string().min(1, "stockMint is required"),
  stockSymbol: z.string().nullable().optional(),
  stockName: z.string().nullable().optional(),
  usdcAmount: z
    .string()
    .min(1, "usdcAmount is required")
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, {
      message: "usdcAmount must be a positive number string",
    }),
  sharesAmount: z.string().nullable().optional(),
  walletAddress: z.string().nullable().optional(),
  txSignature: z.string().nullable().optional(),
  jupiterRequestId: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
});

// ── Withdrawal schemas ────────────────────────────────────────────────────────

export const CreateWithdrawalSchema = z.object({
  privyUserId: z.string().min(1, "privyUserId is required"),
  owner: z.string().min(1, "owner is required"),
  withdrawalId: z.number().int("withdrawalId must be an integer"),
  mintAddress: z.string().min(1, "mintAddress is required"),
  nativeAmount: z.string().min(1, "nativeAmount is required"),
  createdTimestamp: z.number().int("createdTimestamp must be an integer"),
  cooldownSeconds: z.number().int().default(0),
  source: z.string().optional(),
});

export const CompleteWithdrawalSchema = z.object({
  privyUserId: z.string().min(1, "privyUserId is required"),
  withdrawalId: z.number().int("withdrawalId must be an integer"),
});

export const PendingWithdrawalsQuerySchema = z.object({
  privyUserId: z.string().min(1, "privyUserId is required"),
});

// ── Gas sponsorship schemas ───────────────────────────────────────────────────

export const GasSponsorshipCheckSchema = z.object({
  privyUserId: z.string().min(1, "privyUserId is required"),
  amountUSD: z
    .number({ message: "amountUSD is required and must be a number" })
    .nonnegative("amountUSD must be >= 0"),
});

// ── PAJ session schemas ───────────────────────────────────────────────────────

export const UpsertPajSessionSchema = z.object({
  email: z.string().email("Invalid email").nullable().optional(),
  sessionToken: z.string().nullable().optional(),
  expiresAt: z
    .string()
    .datetime({ message: "expiresAt must be an ISO 8601 datetime" })
    .nullable()
    .optional(),
  isActive: z.boolean().nullable().optional(),
  otp: z.string().max(20).nullable().optional(),
  otpPending: z.boolean().nullable().optional(),
  clearOtp: z.boolean().optional(),
});
