import { useState, useMemo, useEffect } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { PriceChartCandle } from "@/services/tokensService";

interface TokensPriceChartProps {
  candles: PriceChartCandle[];
  interval: string;
  symbol: string;
  lastUpdated?: Date | null;
  refreshing?: boolean;
}

type RangeKey = "1D" | "7D" | "30D" | "ALL";

const RANGES: { label: RangeKey; hours: number }[] = [
  { label: "1D", hours: 24 },
  { label: "7D", hours: 24 * 7 },
  { label: "30D", hours: 24 * 30 },
  { label: "ALL", hours: Infinity },
];

function formatTime(unix: number, range: RangeKey): string {
  const d = new Date(unix * 1000);
  if (range === "1D") {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  if (range === "ALL" || range === "30D") {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatPrice(v: number) {
  if (v >= 1000) return `$${(v / 1000).toFixed(2)}k`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  return `$${v.toPrecision(4)}`;
}

function formatVol(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(2)}K`;
  return `$${v.toFixed(2)}`;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0]?.payload as PriceChartCandle;
  if (!d) return null;
  const isUp = d.close >= d.open;
  return (
    <div className="rounded-xl border border-border/60 bg-background/90 backdrop-blur-md p-3 text-xs space-y-1 shadow-xl min-w-[160px]">
      <p className="text-muted-foreground font-medium">{label}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        <span className="text-muted-foreground">Open</span>
        <span className="font-semibold text-right">{formatPrice(d.open)}</span>
        <span className="text-muted-foreground">High</span>
        <span className="font-semibold text-right text-emerald-400">{formatPrice(d.high)}</span>
        <span className="text-muted-foreground">Low</span>
        <span className="font-semibold text-right text-red-400">{formatPrice(d.low)}</span>
        <span className="text-muted-foreground">Close</span>
        <span className={`font-bold text-right ${isUp ? "text-emerald-400" : "text-red-400"}`}>
          {formatPrice(d.close)}
        </span>
        <span className="text-muted-foreground">Volume</span>
        <span className="font-semibold text-right">{formatVol(d.volume)}</span>
      </div>
    </div>
  );
};

export default function TokensPriceChart({ candles, interval, symbol, lastUpdated, refreshing }: TokensPriceChartProps) {
  const [range, setRange] = useState<RangeKey>("7D");
  const [relativeTime, setRelativeTime] = useState<string>("");

  // Update "updated X ago" label every second
  useEffect(() => {
    const update = () => {
      if (!lastUpdated) { setRelativeTime(""); return; }
      const secs = Math.round((Date.now() - lastUpdated.getTime()) / 1000);
      if (secs < 5) setRelativeTime("just now");
      else if (secs < 60) setRelativeTime(`${secs}s ago`);
      else setRelativeTime(`${Math.floor(secs / 60)}m ago`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  const filtered = useMemo(() => {
    if (candles.length === 0) return [];
    const sel = RANGES.find((r) => r.label === range)!;
    if (sel.hours === Infinity) return candles;
    const cutoff = (candles[candles.length - 1].time) - sel.hours * 3600;
    return candles.filter((c) => c.time >= cutoff);
  }, [candles, range]);

  const chartData = useMemo(
    () => filtered.map((c) => ({ ...c, label: formatTime(c.time, range) })),
    [filtered, range]
  );

  if (candles.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
        No price chart data available
      </div>
    );
  }

  const prices = filtered.map((c) => c.close);
  const firstPrice = prices[0];
  const lastPrice = prices[prices.length - 1];
  const isUp = lastPrice >= firstPrice;
  const pctChange = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;
  const color = isUp ? "#10b981" : "#ef4444";
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const pricePad = (maxPrice - minPrice) * 0.1 || 0.01;

  // Build gradient id unique per symbol to avoid SVG conflicts
  const gradId = `price-grad-${symbol}`;

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
              Price Chart <span className="normal-case font-normal text-muted-foreground/60">· {interval} candles</span>
            </p>
            {/* Live indicator */}
            {refreshing ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-semibold">
                <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round"/>
                </svg>
                Refreshing
              </span>
            ) : lastUpdated ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                LIVE
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-0.5">
            <span className="text-lg font-bold">{formatPrice(lastPrice)}</span>
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-md ${isUp ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
              {isUp ? "▲" : "▼"} {Math.abs(pctChange).toFixed(2)}%
            </span>
            {relativeTime && (
              <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap">· Updated {relativeTime}</span>
            )}
          </div>
        </div>
        {/* Range selector */}
        <div className="flex items-center gap-1 bg-secondary/50 rounded-xl p-1 self-start sm:self-auto">
          {RANGES.map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => setRange(r.label)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                range === r.label
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Area price chart */}
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 20 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={60}
            />
            <YAxis
              domain={[minPrice - pricePad, maxPrice + pricePad]}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={false}
              width={60}
              tickFormatter={(v) => formatPrice(v)}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={firstPrice} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4" />
            <Area
              type="monotone"
              dataKey="close"
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradId})`}
              dot={false}
              activeDot={{ r: 4, fill: color, stroke: "var(--background)", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Volume bar chart */}
      <div className="h-16">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
            <XAxis dataKey="label" hide />
            <YAxis hide />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]?.payload as PriceChartCandle;
                return (
                  <div className="rounded-lg border border-border/60 bg-background/90 p-2 text-xs shadow-lg">
                    <span className="text-muted-foreground">Vol </span>
                    <span className="font-semibold">{formatVol(d.volume)}</span>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="volume"
              fill={color}
              opacity={0.35}
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[10px] text-muted-foreground text-center">
        Volume · {symbol} · Source: tokens.xyz
      </p>
    </div>
  );
}
