import { ReactNode } from "react";
import { BarChart2, Shield, Globe, Twitter, Droplets, Users, Activity } from "lucide-react";
import TokensPriceChart from "@/components/TokensPriceChart";
import type { TokensEnrichedAsset, PriceChartResponse } from "@/services/tokensService";
import {
  formatUsd,
  formatNumber,
  formatPercent,
  type TokenDetails,
  type StatBlock,
} from "./stockDetailsUtils";

interface StockEnrichmentProps {
  token: TokenDetails;
  tokensAsset: TokensEnrichedAsset | null;
  tokensLoading: boolean;
  tokensPriceChart: PriceChartResponse | null;
  chartLastUpdated: Date | null;
  chartRefreshing: boolean;
  statBlocks: StatBlock[];
  children?: ReactNode;
}

export default function StockEnrichment({
  token,
  tokensAsset,
  tokensLoading,
  tokensPriceChart,
  chartLastUpdated,
  chartRefreshing,
  statBlocks,
  children,
}: StockEnrichmentProps) {
  return (
    <>
      {/* ── Tokens.xyz enrichment cards ── */}
      {tokensLoading && (
        <p className="text-xs text-muted-foreground animate-pulse">Loading enriched data…</p>
      )}

      {tokensAsset && (
        <>
          {/* Company description — from asset root */}
          {tokensAsset?.assetDescription && (
            <div className="rounded-xl bg-secondary/40 border border-border/60 p-4">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2">About {token.name}</p>
              <p className="text-sm leading-relaxed text-foreground/90">{tokensAsset.assetDescription}</p>
            </div>
          )}

          {/* Key metrics row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            {(token.stats24h?.buyVolume != null || tokensAsset.volume24hUSD != null) && (
              <div className="rounded-xl bg-secondary/40 border border-border/60 p-3 flex flex-col">
                <span className="text-xs text-muted-foreground flex items-center gap-1"><BarChart2 className="w-3 h-3" /> 24h Volume</span>
                <span className="mt-1 font-semibold">{formatUsd((token.stats24h?.buyVolume || 0) + (token.stats24h?.sellVolume || 0) || tokensAsset.volume24hUSD || 0)}</span>
              </div>
            )}
            {(token.mcap != null || tokensAsset.marketCap != null) && (
              <div className="rounded-xl bg-secondary/40 border border-border/60 p-3 flex flex-col">
                <span className="text-xs text-muted-foreground">Market Cap</span>
                <span className="mt-1 font-semibold">{formatUsd(token.mcap ?? tokensAsset.marketCap)}</span>
              </div>
            )}
            {(token.fdv != null || tokensAsset.fdv != null) && (
              <div className="rounded-xl bg-secondary/40 border border-border/60 p-3 flex flex-col">
                <span className="text-xs text-muted-foreground">FDV</span>
                <span className="mt-1 font-semibold">{formatUsd(token.fdv ?? tokensAsset.fdv)}</span>
              </div>
            )}
            {(token.liquidity != null || tokensAsset.liquidity != null) && (
              <div className="rounded-xl bg-secondary/40 border border-border/60 p-3 flex flex-col">
                <span className="text-xs text-muted-foreground">Liquidity</span>
                <span className="mt-1 font-semibold">{formatUsd(token.liquidity ?? tokensAsset.liquidity)}</span>
              </div>
            )}
            {tokensAsset.allTimeHigh != null && (
              <div className="rounded-xl bg-secondary/40 border border-border/60 p-3 flex flex-col">
                <span className="text-xs text-muted-foreground">All-Time High</span>
                <span className="mt-1 font-semibold">
                  {formatUsd(
                    tokensPriceChart && tokensPriceChart.candles.length > 0 && tokensAsset.price
                      ? tokensAsset.allTimeHigh * (tokensAsset.price / tokensPriceChart.candles[tokensPriceChart.candles.length - 1].close)
                      : tokensAsset.allTimeHigh
                  )}
                </span>
              </div>
            )}
            {(token.circSupply != null || tokensAsset.circulatingSupply != null) && (
              <div className="rounded-xl bg-secondary/40 border border-border/60 p-3 flex flex-col">
                <span className="text-xs text-muted-foreground">Circ. Supply</span>
                <span className="mt-1 font-semibold">{formatNumber(token.circSupply ?? tokensAsset.circulatingSupply, { maximumFractionDigits: 0 })}</span>
              </div>
            )}
          </div>

          {/* OHLCV latest bar */}
          {tokensAsset.ohlcv && tokensAsset.ohlcv.length > 0 && (() => {
            const lastBar = tokensAsset.ohlcv![tokensAsset.ohlcv!.length - 1];
            const bar = { ...lastBar, close: tokensAsset.price ?? lastBar.close };
            return (
              <div className="rounded-xl bg-secondary/40 border border-border/60 p-3">
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2">Latest OHLCV</p>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-sm">
                  {(["open", "high", "low", "close", "volume"] as const).map((k) => (
                    <div key={k} className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground uppercase">{k}</span>
                      <span className="font-semibold text-xs">
                        {k === "volume"
                          ? formatNumber((bar as any)[k], { maximumFractionDigits: 0 })
                          : formatUsd((bar as any)[k])}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Markets (DEX pools) */}
          {tokensAsset.markets && tokensAsset.markets.length > 0 && (
            <div className="rounded-xl bg-secondary/40 border border-border/60 p-3">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2">DEX Markets</p>
              <div className="space-y-2">
                {tokensAsset.markets.slice(0, 5).map((m, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{m.source ?? "—"}</span>
                      {m.name && <span className="text-muted-foreground">{m.name}</span>}
                    </div>
                    <div className="flex items-center gap-4">
                      {m.price != null && <span>{formatUsd(m.price)}</span>}
                      {m.volume24h != null && (
                        <span className="text-muted-foreground">{formatUsd(m.volume24h)} vol</span>
                      )}
                      {m.liquidity != null && (
                        <span className="text-muted-foreground">{formatUsd(m.liquidity)} liq</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── tokens.xyz interactive price chart ── */}
          {tokensPriceChart && tokensPriceChart.candles.length > 0 && (
            <div className="rounded-xl bg-secondary/40 border border-border/60 p-4">
              <TokensPriceChart
                candles={(() => {
                  if (!tokensPriceChart || !tokensPriceChart.candles || tokensPriceChart.candles.length === 0) return [];
                  
                  if (tokensAsset?.price != null) {
                    const originalLastClose = tokensPriceChart.candles[tokensPriceChart.candles.length - 1].close;
                    if (originalLastClose && originalLastClose > 0) {
                      const ratio = tokensAsset.price / originalLastClose;
                      return tokensPriceChart.candles.map(c => ({
                        ...c,
                        open: c.open * ratio,
                        high: c.high * ratio,
                        low: c.low * ratio,
                        close: c.close * ratio,
                      }));
                    }
                  }
                  return tokensPriceChart.candles;
                })()}
                interval={tokensPriceChart.interval}
                symbol={token.symbol}
                lastUpdated={chartLastUpdated}
                refreshing={chartRefreshing}
              />
            </div>
          )}
        </>
      )}

      {children}

      {/* Supply details */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="rounded-xl bg-secondary/40 border border-border/60 p-3 flex flex-col">
          <span className="text-xs text-muted-foreground">Circulating supply</span>
          <span className="mt-1 font-semibold">
            {formatNumber(token.circSupply, { maximumFractionDigits: 0 })}
          </span>
        </div>
        <div className="rounded-xl bg-secondary/40 border border-border/60 p-3 flex flex-col">
          <span className="text-xs text-muted-foreground">Total supply</span>
          <span className="mt-1 font-semibold">
            {formatNumber(token.totalSupply, { maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>

      {/* Stats section */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Performance
        </h2>
        {/* Live price changes from tokens.xyz */}
        {(tokensAsset?.priceChange1hPercent != null || tokensAsset?.priceChange24hPercent != null) && (
          <div className="grid grid-cols-2 gap-3">
            {tokensAsset?.priceChange1hPercent != null && (
              <div className="rounded-xl bg-secondary/40 border border-border/60 p-3 flex flex-col gap-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">1h Change</span>
                <span className={`text-sm font-bold ${
                  tokensAsset.priceChange1hPercent >= 0 ? "text-emerald-500" : "text-red-500"
                }`}>
                  {tokensAsset.priceChange1hPercent >= 0 ? "▲" : "▼"} {Math.abs(tokensAsset.priceChange1hPercent).toFixed(3)}%
                </span>
              </div>
            )}
            {tokensAsset?.priceChange24hPercent != null && (
              <div className="rounded-xl bg-secondary/40 border border-border/60 p-3 flex flex-col gap-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">24h Change</span>
                <span className={`text-sm font-bold ${
                  tokensAsset.priceChange24hPercent >= 0 ? "text-emerald-500" : "text-red-500"
                }`}>
                  {tokensAsset.priceChange24hPercent >= 0 ? "▲" : "▼"} {Math.abs(tokensAsset.priceChange24hPercent).toFixed(3)}%
                </span>
              </div>
            )}
          </div>
        )}
        {/* Jupiter on-chain window stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {statBlocks.map(({ label, key }) => {
            const windowStats = token[key];
            const change = windowStats?.priceChange ?? null;
            const buyVolume = windowStats?.buyVolume ?? null;

            const isPositive = typeof change === "number" && change > 0;
            const isNegative = typeof change === "number" && change < 0;

            return (
              <div
                key={key}
                className="rounded-xl bg-secondary/40 border border-border/60 p-3 flex flex-col gap-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">
                    {label}
                  </span>
                  <span
                    className={`text-xs font-semibold ${
                      isPositive
                        ? "text-emerald-500"
                        : isNegative
                        ? "text-red-500"
                        : "text-muted-foreground"
                    }`}
                  >
                    {formatPercent(change)}
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  Buy volume: {formatUsd(buyVolume ?? null)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Risk score (under Performance) */}
        {tokensAsset?.riskScore != null && (
          <div className="rounded-xl bg-secondary/40 border border-border/60 p-4 mt-4 space-y-4">
            <div className="flex flex-col gap-1">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide flex items-center gap-1">
                <Shield className="w-3 h-3" /> Risk Assessment
              </p>
              <div className="flex items-center gap-3">
                <div
                  className={`text-sm font-bold px-3 py-1 rounded-full ${
                    tokensAsset.riskScore <= 30
                      ? "bg-emerald-500/20 text-emerald-400"
                      : tokensAsset.riskScore <= 60
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                >
                  Score: {tokensAsset.riskScore}{tokensAsset.riskGrade ? ` (${tokensAsset.riskGrade})` : ""}
                </div>
                {tokensAsset.riskLabel && (
                  <span className="text-sm font-medium text-muted-foreground">
                    {tokensAsset.riskLabel}
                  </span>
                )}
              </div>
            </div>
            {/* Risk component scores */}
            {tokensAsset.riskComponents && (
              <div className="grid grid-cols-3 gap-3">
                {([
                  { key: "liquidityHealth" as const, label: "Liquidity", icon: <Droplets className="w-3 h-3" /> },
                  { key: "holderDistribution" as const, label: "Holders", icon: <Users className="w-3 h-3" /> },
                  { key: "tradingActivity" as const, label: "Trading", icon: <Activity className="w-3 h-3" /> },
                ]).map(({ key, label, icon }) => {
                  const comp = tokensAsset.riskComponents?.[key];
                  if (!comp?.hasData) return null;
                  const score = comp.score ?? 0;
                  const status = comp.status ?? "info";
                  const color = status === "safe" ? "bg-emerald-500" : status === "warning" ? "bg-yellow-500" : status === "danger" ? "bg-red-500" : "bg-muted";
                  const textColor = status === "safe" ? "text-emerald-400" : status === "warning" ? "text-yellow-400" : status === "danger" ? "text-red-400" : "text-muted-foreground";
                  return (
                    <div key={key} className="flex flex-col gap-1.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wide flex items-center gap-1 ${textColor}`}>
                        {icon} {label}
                      </span>
                      <div className="h-2 w-full rounded-full bg-secondary/80 overflow-hidden">
                        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
                      </div>
                      <span className="text-[11px] font-medium text-muted-foreground">{Number(score).toFixed(2)}/100</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* About xStocks — product/platform description from profile — at bottom */}
      {tokensAsset?.description && (
        <div className="rounded-xl bg-secondary/30 border border-border/40 p-4 space-y-2">
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">About xStocks</p>
          <p className="text-xs leading-relaxed text-muted-foreground">{tokensAsset.description}</p>
          {(tokensAsset.website || tokensAsset.twitter) && (
            <div className="flex items-center gap-3 pt-1">
              {tokensAsset.website && (
                <a
                  href={tokensAsset.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Globe className="w-3 h-3" /> Website
                </a>
              )}
              {tokensAsset.twitter && (
                <a
                  href={tokensAsset.twitter.startsWith("http") ? tokensAsset.twitter : `https://x.com/${tokensAsset.twitter.replace(/^@/, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Twitter className="w-3 h-3" /> Twitter / X
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
