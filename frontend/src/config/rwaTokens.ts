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
  minBuyCostPayout?: number;
  minBuyShares?: number;
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
    icon: "https://res.cloudinary.com/djalafcj9/image/upload/v1789376611/getequity/profiles/user/kmtjh3f6nlvsyup1hqpu.png",
  },
  {
    id: "ntbs5",
    name: "Nigerian Treasury Bill Series 5",
    symbol: "NTBS5",
    mint: "9C3xMC6J3dWnwLof5xwCasN4tVtNcxVCpbCbrVBmGWwj",
    payoutMint: "3jiqwBQVRC5zRwHyqvnkQurebJ5RNxg3F5fXMwaxgkv8", // Mainnet cNGN
    payoutSymbol: "cNGN",
    decimals: 6,
    payoutDecimals: 6,
    category: "Fund",
    issuer: "Comercio Partners",
    location: "Nigeria",
    description: "Tokenized Nigerian Treasury Bill Series 5 yielding 16.50% p.a. settled in cNGN on Solana.",
    cluster: "mainnet-beta",
    icon: "https://res.cloudinary.com/djalafcj9/image/upload/v1718131106/getequity/profiles/user/pxosjt6yphhalmdwxvkz.png",
    minBuyCostPayout: 10000, // ₦10,000 cNGN (1 unit)
    minBuyShares: 1, // 1 NTBS5 unit
  },
  {
    id: "gntb",
    name: "GetEquity Nigerian Treasury Bills Fund",
    symbol: "gNTB",
    mint:
      import.meta.env.VITE_GETEQUITY_GNTB_MINT ||
      "CsMkseiQZJiaXSyiE7NZayosWWQmycwdYxU85aYCxg5d",
    payoutMint: "3jiqwBQVRC5zRwHyqvnkQurebJ5RNxg3F5fXMwaxgkv8", // Mainnet cNGN
    payoutSymbol: "cNGN",
    decimals: 6,
    payoutDecimals: 6,
    category: "Fund",
    issuer: "BAS Capital",
    location: "Nigeria",
    description: "Tokenized Nigerian Treasury Bills Fund yielding 15.50% p.a. settled in cNGN on Solana.",
    dealUrl: "https://getequity.io/token/6ab53b88d3c1b700027204ad",
    cluster: "mainnet-beta",
    icon: "https://res.cloudinary.com/djalafcj9/image/upload/v1790261870/getequity/profiles/user/y25bkolqctaug5w5nuoh.png",
    minBuyCostPayout: 1000, // ₦1,000 cNGN (1,000 units)
    minBuyShares: 1000, // 1,000 gNTB units
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
