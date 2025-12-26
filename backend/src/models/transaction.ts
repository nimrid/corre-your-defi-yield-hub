export type TransactionDirection = "incoming" | "outgoing";

export interface TransactionInput {
  privyUserId: string;
  chainType: "solana" | "ethereum" | string;
  assetSymbol: string; // e.g. "USDC"
  amount: string; // decimal string, e.g. "10.5"
  direction: TransactionDirection;
  txSignature?: string | null; // Solana or EVM tx hash/signature
  fromAddress: string;
  toAddress: string;
  // Optional free-form metadata for future use (e.g. source: "send_wallet" | "external_deposit")
  source?: string;
}
