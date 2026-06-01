/**
 * tokensService.ts
 * Wrapper for the tokens.xyz API (https://api.tokens.xyz)
 *
 * In development, calls go through the Vite dev proxy at /tokens-api
 * which forwards to https://api.tokens.xyz and injects x-api-key.
 * This avoids CORS issues from the browser.
 *
 * Actual response structure (GET /v1/assets/:id?include=profile,risk,ohlcv,markets):
 * {
 *   asset: { assetId, name, symbol, imageUrl, category, stats: { price, volume24hUSD, marketCap, priceChange24hPercent, ... } }
 *   includes: {
 *     profile: { ok, data: { description, price, priceChange24h, volume24h, marketCap, fdv, circulatingSupply, allTimeHigh, links: { website, twitter } } }
 *     risk:    { ok, data: { marketScore: { score, grade, label, tone } } }
 *     ohlcv:   { ok, data: OHLCVBar[] }
 *     markets: { ok, data: MarketEntry[], total }
 *   }
 * }
 */

// Use Vite proxy in dev, fall back to direct URL for production
const BASE_URL = "/tokens-api";

async function tokensFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`tokens.xyz API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ─── Types (matching actual API response) ─────────────────────────────────────

export interface TokensAssetStats {
  price?: number | null;
  volume24hUSD?: number | null;
  marketCap?: number | null;
  priceChange24hPercent?: number | null;
  priceChange1hPercent?: number | null;
  liquidity?: number | null;
}

export interface TokensAsset {
  assetId?: string;
  name?: string;
  symbol?: string;
  imageUrl?: string;
  category?: string;
  description?: string;
  stats?: TokensAssetStats;
}

export interface TokensProfileData {
  price?: number | null;
  priceChange24h?: number | null;
  volume24h?: number | null;
  marketCap?: number | null;
  fdv?: number | null;
  circulatingSupply?: number | null;
  totalSupply?: number | null;
  allTimeHigh?: number | null;
  allTimeHighDate?: string | null;
  description?: string | null;
  links?: {
    website?: string;
    twitter?: string;
    telegram?: string;
    [key: string]: string | undefined;
  };
}

export interface TokensRiskComponentEntry {
  score?: number | null;
  status?: string | null; // "safe" | "warning" | "danger" | "info"
  hasData?: boolean;
}

export interface TokensRiskComponents {
  liquidityHealth?: TokensRiskComponentEntry;
  holderDistribution?: TokensRiskComponentEntry;
  tradingActivity?: TokensRiskComponentEntry;
  holderCount?: TokensRiskComponentEntry;
}

export interface TokensRiskScore {
  score?: number | null;
  grade?: string | null;
  label?: string | null;
  tone?: string | null;
  caps?: string[];
  borderlineSignals?: string[];
  components?: TokensRiskComponents;
}

export interface TokensOHLCVBar {
  time?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
}

export interface TokensMarketEntry {
  address?: string;
  name?: string;
  source?: string;
  price?: number | null;
  liquidity?: number | null;
  volume24h?: number | null;
  trade24h?: number | null;
  base?: { symbol?: string; address?: string; icon?: string };
  quote?: { symbol?: string; address?: string; icon?: string };
}

/** Normalised shape your components actually use */
export interface TokensEnrichedAsset {
  // From asset root
  name?: string;
  symbol?: string;
  imageUrl?: string;
  category?: string;
  /** Company/token description from asset root (e.g. "Circle Internet Group is…") */
  assetDescription?: string | null;
  // Stats (live on-chain)
  price?: number | null;
  volume24hUSD?: number | null;
  marketCap?: number | null;
  priceChange24hPercent?: number | null;
  priceChange1hPercent?: number | null;
  liquidity?: number | null;
  // From profile include
  priceChange24h?: number | null;
  volume24h?: number | null;
  fdv?: number | null;
  circulatingSupply?: number | null;
  totalSupply?: number | null;
  allTimeHigh?: number | null;
  /** xStocks marketing/product description from profile */
  description?: string | null;
  website?: string | null;
  twitter?: string | null;
  telegram?: string | null;
  // From risk include
  riskScore?: number | null;
  riskGrade?: string | null;
  riskLabel?: string | null;
  riskTone?: string | null;
  riskComponents?: TokensRiskComponents | null;
  // From ohlcv include
  ohlcv?: TokensOHLCVBar[];
  // From markets include
  markets?: TokensMarketEntry[];
}

/** One candle from the /price-chart endpoint */
export interface PriceChartCandle {
  time: number;   // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Full /price-chart response */
export interface PriceChartResponse {
  assetId: string;
  interval: string;
  from: number;
  to: number;
  candles: PriceChartCandle[];
}

// kept for backwards compat (not used in UI anymore)
export interface TokensPriceChartPoint {
  time: number;
  price: number;
}

// ─── Raw API response types ────────────────────────────────────────────────────

interface RawAssetResponse {
  asset?: TokensAsset & { stats?: TokensAssetStats };
  includes?: {
    profile?: { ok?: boolean; data?: TokensProfileData };
    risk?: { ok?: boolean; data?: { marketScore?: TokensRiskScore } };
    ohlcv?: { ok?: boolean; data?: TokensOHLCVBar[] };
    markets?: { ok?: boolean; data?: TokensMarketEntry[]; total?: number };
  };
}

// ─── API calls ─────────────────────────────────────────────────────────────────

/**
 * Fetch full asset details and normalise into a flat, easy-to-use object.
 * Endpoint: GET /v1/assets/:assetId?include=profile,risk,ohlcv,markets
 */
export async function fetchTokensAsset(assetId: string): Promise<TokensEnrichedAsset> {
  const raw = await tokensFetch<RawAssetResponse>(
    `/v1/assets/${encodeURIComponent(assetId)}?include=profile,risk,ohlcv,markets`
  );

  const asset = raw.asset ?? {};
  const stats = asset.stats ?? {};
  const profileData = raw.includes?.profile?.data ?? {};
  const riskScore = raw.includes?.risk?.data?.marketScore ?? {};
  const ohlcvData = raw.includes?.ohlcv?.data ?? [];
  const marketsData = raw.includes?.markets?.data ?? [];

  return {
    // Identity
    name: asset.name,
    symbol: asset.symbol,
    imageUrl: asset.imageUrl,
    category: asset.category,
    assetDescription: asset.description ?? null,
    // Live price/volume from stats (most up-to-date)
    price: stats.price ?? profileData.price ?? null,
    volume24hUSD: stats.volume24hUSD ?? null,
    marketCap: stats.marketCap ?? profileData.marketCap ?? null,
    priceChange24hPercent: stats.priceChange24hPercent ?? null,
    priceChange1hPercent: stats.priceChange1hPercent ?? null,
    liquidity: stats.liquidity ?? null,
    // From profile
    priceChange24h: profileData.priceChange24h ?? null,
    volume24h: profileData.volume24h ?? null,
    fdv: profileData.fdv ?? null,
    circulatingSupply: profileData.circulatingSupply ?? null,
    totalSupply: profileData.totalSupply ?? null,
    allTimeHigh: profileData.allTimeHigh ?? null,
    description: profileData.description ?? null,
    website: profileData.links?.website ?? null,
    twitter: profileData.links?.twitter ?? null,
    telegram: profileData.links?.telegram ?? null,
    // Risk
    riskScore: typeof riskScore.score === "number" ? riskScore.score : null,
    riskGrade: riskScore.grade ?? null,
    riskLabel: riskScore.label ?? null,
    riskTone: riskScore.tone ?? null,
    riskComponents: (riskScore.components as TokensRiskComponents) ?? null,
    // OHLCV
    ohlcv: ohlcvData,
    // Markets
    markets: marketsData,
  };
}

/**
 * Fetch OHLCV candle data
 * Endpoint: GET /v1/assets/:assetId/ohlcv
 */
export async function fetchTokensOHLCV(
  assetId: string,
  params?: { resolution?: string; from?: number; to?: number; limit?: number }
): Promise<TokensOHLCVBar[]> {
  const qs = new URLSearchParams();
  if (params?.resolution) qs.set("resolution", params.resolution);
  if (params?.from) qs.set("from", String(params.from));
  if (params?.to) qs.set("to", String(params.to));
  if (params?.limit) qs.set("limit", String(params.limit));
  const query = qs.toString() ? `?${qs.toString()}` : "";
  const raw = await tokensFetch<{ data?: TokensOHLCVBar[] } | TokensOHLCVBar[]>(
    `/v1/assets/${encodeURIComponent(assetId)}/ohlcv${query}`
  );
  return Array.isArray(raw) ? raw : ((raw as any).data ?? []);
}

/**
 * Fetch price chart candle data
 * Endpoint: GET /v1/assets/:assetId/price-chart
 * Returns: { assetId, interval, from, to, candles: [{time, open, high, low, close, volume}] }
 */
export async function fetchTokensPriceChart(
  assetId: string,
  params?: { interval?: string; from?: number; to?: number }
): Promise<PriceChartResponse> {
  const qs = new URLSearchParams();
  if (params?.interval) qs.set("interval", params.interval);
  if (params?.from) qs.set("from", String(params.from));
  if (params?.to) qs.set("to", String(params.to));
  const query = qs.toString() ? `?${qs.toString()}` : "";
  const raw = await tokensFetch<PriceChartResponse>(
    `/v1/assets/${encodeURIComponent(assetId)}/price-chart${query}`
  );
  return {
    assetId: raw.assetId ?? assetId,
    interval: raw.interval ?? "1H",
    from: raw.from ?? 0,
    to: raw.to ?? 0,
    candles: Array.isArray(raw.candles) ? raw.candles : [],
  };
}
