export interface RwaTokenConfig {
  id: string;
  name: string;
  symbol: string;
  mint: string;
  payoutMint: string;
  payoutSymbol: string;
  decimals: number;
  payoutDecimals: number;
  category: "Equity" | "Private Credit" | "Commodity" | "Real Estate" | "Fund";
  issuer: string;
  location?: string;
  description: string;
  dealUrl?: string;
  cluster: "mainnet-beta" | "devnet";
  icon?: string;
}

export const RWA_TOKENS: RwaTokenConfig[] = [
  {
    id: "dpri",
    name: "Dangote Petroleum Refinery IPO",
    symbol: "DPRI",
    mint:
      import.meta.env.VITE_GETEQUITY_DPRI_MINT ||
      "4SARoiczTriUakwqmNtmP45hDrFV46umaJVwjQC8JLiK",
    payoutMint:
      import.meta.env.VITE_GETEQUITY_DEFAULT_PAYOUT_MINT ||
      "3jiqwBQVRC5zRwHyqvnkQurebJ5RNxg3F5fXMwaxgkv8", // Mainnet cNGN
    payoutSymbol:
      import.meta.env.VITE_GETEQUITY_DEFAULT_PAYOUT_SYMBOL || "cNGN",
    decimals: 6,
    payoutDecimals: 6,
    category: "Equity",
    issuer: "Anchoria Asset Managers",
    location: "Lagos, Nigeria",
    description: "Pre-IPO equity allocation in the Dangote Petroleum Refinery complex.",
    cluster: "mainnet-beta",
  },
];

export function findRwaToken(query: string): RwaTokenConfig | undefined {
  if (!query) return undefined;
  const normalized = query.trim().toUpperCase();
  return RWA_TOKENS.find(
    (t) =>
      t.symbol.toUpperCase() === normalized ||
      t.id.toUpperCase() === normalized ||
      t.name.toUpperCase().includes(normalized) ||
      t.mint.toLowerCase() === query.trim().toLowerCase()
  );
}
