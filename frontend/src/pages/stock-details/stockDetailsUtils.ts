// Shared types, constants, and pure utility functions for the stock details page.

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface TokenStatsWindow {
  priceChange?: number | null;
  buyVolume?: number | null;
  sellVolume?: number | null;
}

export interface TokenDetails {
  id: string;
  address: string;
  name: string;
  symbol: string;
  icon: string | null;
  circSupply: number | null;
  totalSupply: number | null;
  mcap: number | null;
  fdv: number | null;
  liquidity: number | null;
  usdPrice: number | null;
  decimals?: number | null;
  stats5m?: TokenStatsWindow;
  stats1h?: TokenStatsWindow;
  stats6h?: TokenStatsWindow;
  stats24h?: TokenStatsWindow;
  stats7d?: TokenStatsWindow;
  stats30d?: TokenStatsWindow;
}

export interface StatBlock {
  label: string;
  key: keyof Pick<TokenDetails, "stats5m" | "stats1h" | "stats6h" | "stats24h" | "stats7d" | "stats30d">;
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export const STAT_BLOCKS: StatBlock[] = [
  { label: "5m", key: "stats5m" },
  { label: "1h", key: "stats1h" },
  { label: "6h", key: "stats6h" },
  { label: "24h", key: "stats24h" },
  { label: "7d", key: "stats7d" },
  { label: "30d", key: "stats30d" },
];

// ─── URL Builders ────────────────────────────────────────────────────────────

export const buildTokenUrl = (mint: string) => {
  const base = "https://api.jup.ag/tokens/v2/search";
  const params = new URLSearchParams({ query: mint });
  return `${base}?${params.toString()}`;
};

// ─── Formatters ──────────────────────────────────────────────────────────────

export const formatNumber = (value: number | null, opts?: Intl.NumberFormatOptions) => {
  if (value == null || Number.isNaN(value)) return "-";
  return value.toLocaleString(undefined, opts ?? { maximumFractionDigits: 2 });
};

export const formatUsd = (value: number | null) => {
  if (value == null || Number.isNaN(value)) return "-";
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export const formatPercent = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) return "-";
  return `${value.toFixed(2)}%`;
};

// ─── Base64 helpers (browser-safe, no Node Buffer dependency) ────────────────

export const base64ToUint8Array = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export const uint8ArrayToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};
