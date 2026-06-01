import { useEffect, useState } from "react";
import {
  fetchTokensAsset,
  fetchTokensPriceChart,
  type TokensEnrichedAsset,
  type PriceChartResponse,
} from "@/services/tokensService";
import { buildTokenUrl, type TokenDetails } from "./stockDetailsUtils";

/**
 * Fetches the Jupiter token data and Tokens.xyz enrichment (profile, risk,
 * price chart) for a given mint, and keeps the price chart and asset stats
 * auto-refreshing on an interval.
 */
export function useTokenDetails(mint: string | undefined) {
  const [token, setToken] = useState<TokenDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tokens.xyz enriched data
  const [tokensAsset, setTokensAsset] = useState<TokensEnrichedAsset | null>(null);
  const [tokensPriceChart, setTokensPriceChart] = useState<PriceChartResponse | null>(null);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [chartLastUpdated, setChartLastUpdated] = useState<Date | null>(null);
  const [chartRefreshing, setChartRefreshing] = useState(false);

  const latestChartPrice = tokensPriceChart?.candles?.length
    ? tokensPriceChart.candles[tokensPriceChart.candles.length - 1].close
    : null;

  // ── Jupiter token lookup ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mint) {
      setError("No stock selected");
      setLoading(false);
      return;
    }

    const apiKey = import.meta.env.VITE_JUP_API_KEY as string | undefined;
    if (!apiKey) {
      setError("Jupiter API key is not configured (VITE_JUP_API_KEY)");
      setLoading(false);
      return;
    }

    const fetchToken = async () => {
      try {
        setLoading(true);
        setError(null);

        const url = buildTokenUrl(mint);
        const res = await fetch(url, {
          method: "GET",
          headers: { "x-api-key": apiKey },
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch token: ${res.status}`);
        }

        const data: any = await res.json();
        const first = Array.isArray(data) && data.length > 0 ? data[0] : null;
        if (!first) {
          setError("Could not find this stock on Jupiter");
          return;
        }

        const mapped: TokenDetails = {
          id: first.id ?? first.address ?? mint,
          address: first.address ?? mint,
          name: first.name,
          symbol: first.symbol,
          icon: first.icon ?? null,
          circSupply: typeof first.circSupply === "number" ? first.circSupply : null,
          totalSupply: typeof first.totalSupply === "number" ? first.totalSupply : null,
          mcap: typeof first.mcap === "number" ? first.mcap : null,
          usdPrice: typeof first.usdPrice === "number" ? first.usdPrice : null,
          decimals: typeof first.decimals === "number" ? first.decimals : null,
          stats5m: first.stats5m,
          stats1h: first.stats1h,
          stats6h: first.stats6h,
          stats24h: first.stats24h,
          stats7d: first.stats7d,
          stats30d: first.stats30d,
        };

        setToken(mapped);
      } catch (err: any) {
        setError(err?.message ?? "Failed to load stock details");
      } finally {
        setLoading(false);
      }
    };

    void fetchToken();
  }, [mint]);

  // ── Tokens.xyz enrichment + auto-refresh ──────────────────────────────────
  useEffect(() => {
    if (!mint) return;
    setTokensLoading(true);
    setTokensAsset(null);
    setTokensPriceChart(null);
    setChartLastUpdated(null);

    // Initial load — fetch both in parallel
    const initialLoad = async () => {
      try {
        const [assetData, chartData] = await Promise.allSettled([
          fetchTokensAsset(mint),
          fetchTokensPriceChart(mint),
        ]);
        if (assetData.status === "fulfilled") setTokensAsset(assetData.value);
        if (chartData.status === "fulfilled") {
          setTokensPriceChart(chartData.value);
          setChartLastUpdated(new Date());
        } else {
          console.warn("[TokensAPI] price-chart failed:", (chartData as PromiseRejectedResult).reason);
        }
      } catch (err) {
        console.warn("[TokensAPI] enrichment error:", err);
      } finally {
        setTokensLoading(false);
      }
    };
    void initialLoad();

    // Refresh price chart every 30 seconds
    const chartInterval = setInterval(async () => {
      try {
        setChartRefreshing(true);
        const chartData = await fetchTokensPriceChart(mint);
        setTokensPriceChart(chartData);
        setChartLastUpdated(new Date());
      } catch (err) {
        console.warn("[TokensAPI] chart refresh failed:", err);
      } finally {
        setChartRefreshing(false);
      }
    }, 30_000);

    // Refresh asset stats (price, volume, 24h change) every 60 seconds
    const assetInterval = setInterval(async () => {
      try {
        const assetData = await fetchTokensAsset(mint);
        setTokensAsset(assetData);
      } catch (err) {
        console.warn("[TokensAPI] asset refresh failed:", err);
      }
    }, 60_000);

    return () => {
      clearInterval(chartInterval);
      clearInterval(assetInterval);
    };
  }, [mint]);

  return {
    token,
    loading,
    error,
    tokensAsset,
    tokensPriceChart,
    tokensLoading,
    chartLastUpdated,
    chartRefreshing,
    latestChartPrice,
  };
}
