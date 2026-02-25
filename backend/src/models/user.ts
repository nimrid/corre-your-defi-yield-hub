export type ChainType = "solana" | "ethereum";

export interface WalletInput {
  address: string;
  chainType: ChainType;
  isLinked?: boolean;
}

export interface UserInput {
  privyUserId: string;
  email?: string | null;
  name?: string | null;
  wallets: WalletInput[];
  referredByCode?: string | null;
}
