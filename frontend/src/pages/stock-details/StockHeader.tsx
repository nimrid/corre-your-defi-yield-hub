import { Copy, TrendingUp, TrendingDown } from "lucide-react";
import type { TokensEnrichedAsset } from "@/services/tokensService";
import { formatUsd, formatPercent, type TokenDetails } from "./stockDetailsUtils";

interface StockHeaderProps {
  token: TokenDetails;
  tokensAsset: TokensEnrichedAsset | null;
  latestChartPrice: number | null;
}

export default function StockHeader({ token, tokensAsset, latestChartPrice }: StockHeaderProps) {
  return (
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-full overflow-hidden bg-muted flex items-center justify-center text-sm font-semibold">
        {(tokensAsset?.imageUrl ?? token.icon) ? (
          <img
            src={tokensAsset?.imageUrl ?? token.icon!}
            alt={token.symbol}
            className="w-full h-full object-cover"
          />
        ) : (
          <span>{token.symbol.slice(0, 3).toUpperCase()}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold truncate">{token.name}</h1>
        <p className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <span>{token.symbol}</span>
          <span className="text-[10px] sm:text-xs font-mono truncate max-w-[9rem] sm:max-w-[12rem]">
            {token.address.slice(0, 4)}...{token.address.slice(-4)}
          </span>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(token.address).catch(() => {})}
            className="p-1 rounded hover:bg-secondary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <Copy className="w-3 h-3" />
          </button>
        </p>
        {tokensAsset?.category && (
          <span className="inline-block mt-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
            {tokensAsset.category}
          </span>
        )}
      </div>
      <div className="text-right">
        <p className="text-lg sm:text-2xl font-bold">
          {formatUsd(tokensAsset?.price ?? latestChartPrice ?? token.usdPrice)}
        </p>
        {/* 24h change from Tokens API */}
        {tokensAsset?.priceChange24hPercent != null && (
          <p
            className={`text-xs font-semibold flex items-center justify-end gap-1 ${
              tokensAsset.priceChange24hPercent >= 0
                ? "text-emerald-500"
                : "text-red-500"
            }`}
          >
            {tokensAsset.priceChange24hPercent >= 0 ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {formatPercent(tokensAsset.priceChange24hPercent)}
          </p>
        )}
        {typeof token.mcap === "number" && (
          <p className="text-xs text-muted-foreground">Mcap {formatUsd(token.mcap)}</p>
        )}
      </div>
    </div>
  );
}
