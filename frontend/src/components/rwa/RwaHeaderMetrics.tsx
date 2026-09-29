import React from "react";
import { ArrowLeft, RefreshCw, Building2, Info, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import type { RwaTokenConfig } from "@/config/rwaTokens";

interface RwaHeaderMetricsProps {
  rwaConfig: RwaTokenConfig;
  unitPrice: number;
  feePct: number;
  vaultBal: string;
  isActive: boolean;
  userRwaShares: number | null;
  userUsdcBalance: number | null;
  userCngnBalance: number | null;
  userSolBalance: number | null;
  loading: boolean;
  onRefresh: () => void;
  onOpenTrade: (direction: "buy" | "sell") => void;
}

export const RwaHeaderMetrics: React.FC<RwaHeaderMetricsProps> = ({
  rwaConfig,
  unitPrice,
  feePct,
  vaultBal,
  isActive,
  userRwaShares,
  userUsdcBalance,
  userCngnBalance,
  userSolBalance,
  loading,
  onRefresh,
  onOpenTrade,
}) => {
  const navigate = useNavigate();
  const holdingsValue = (userRwaShares ?? 0) * unitPrice;

  return (
    <>
      {/* Top Navigation & Refresh */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate("/invest/private-market")}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to African stocks</span>
        </button>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full gap-1.5 text-xs"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh On-Chain</span>
        </Button>
      </div>

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="w-14 h-14 rounded-2xl border border-primary/20 bg-primary/10">
            <AvatarImage
              src={rwaConfig.icon}
              alt={rwaConfig.name}
              className="object-cover"
            />
            <AvatarFallback className="rounded-2xl bg-primary/10 text-primary text-xl font-bold">
              {rwaConfig.symbol.slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight">
                {rwaConfig.name}
              </h1>
              <Badge variant="outline" className="text-xs">
                {rwaConfig.symbol}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {rwaConfig.category}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
              <Building2 className="w-3.5 h-3.5" />
              <span>{rwaConfig.issuer}</span>
              {rwaConfig.location && <span>&bull; {rwaConfig.location}</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-secondary/40 border border-border/60 rounded-xl p-3.5 space-y-1">
          <span className="text-xs text-muted-foreground">Unit Price</span>
          <p className="text-lg font-bold text-foreground">
            {rwaConfig.payoutSymbol === "cNGN" ? "₦" : "$"}
            {unitPrice.toFixed(2)}{" "}
            <span className="text-xs font-normal text-muted-foreground">
              {rwaConfig.payoutSymbol}
            </span>
          </p>
        </div>

        <div className="bg-secondary/40 border border-border/60 rounded-xl p-3.5 space-y-1">
          <span className="text-xs text-muted-foreground">Min. Order</span>
          <p className="text-lg font-bold text-foreground">
            {rwaConfig.minBuyCostPayout
              ? `₦${rwaConfig.minBuyCostPayout.toLocaleString()}`
              : "None"}
            <span className="text-xs font-normal text-muted-foreground block">
              {rwaConfig.minBuyShares
                ? `(${rwaConfig.minBuyShares} ${rwaConfig.symbol})`
                : ""}
            </span>
          </p>
        </div>

        <div className="bg-secondary/40 border border-border/60 rounded-xl p-3.5 space-y-1">
          <span className="text-xs text-muted-foreground">Trading Fee</span>
          <p className="text-lg font-bold text-foreground">{feePct}%</p>
        </div>

        <div className="bg-secondary/40 border border-border/60 rounded-xl p-3.5 space-y-1">
          <span className="text-xs text-muted-foreground">Vault Liquidity</span>
          <p className="text-lg font-bold text-foreground truncate">{vaultBal}</p>
        </div>

        <div className="bg-secondary/40 border border-border/60 rounded-xl p-3.5 space-y-1">
          <span className="text-xs text-muted-foreground">Status</span>
          <div className="flex items-center gap-1.5 pt-0.5">
            <span
              className={`w-2 h-2 rounded-full ${
                isActive ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
            <span className="text-sm font-semibold">
              {isActive ? "Active" : "Pending Activation"}
            </span>
          </div>
        </div>
      </div>

      {/* Inactive Notice Banner */}
      {!isActive && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 p-4 flex items-start gap-3 text-xs text-amber-600 dark:text-amber-400">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-sm block">
              Trading Pending Activation on Solana
            </span>
            <span>
              The {rwaConfig.symbol} token vault is verified on-chain (
              {vaultBal} units vaulted). The issuer ({rwaConfig.issuer}) will open
              active trading shortly. You can preview all term sheet details, quotes,
              and swap routes below.
            </span>
          </div>
        </div>
      )}

      {/* User Position & Action Buttons */}
      <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-secondary/30 to-secondary/10 border border-primary/20 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Your Position</span>
          </div>
          <span className="text-xs text-muted-foreground">
            Wallet:{" "}
            {rwaConfig.payoutSymbol === "cNGN"
              ? `${
                  userUsdcBalance !== null
                    ? `${userUsdcBalance.toFixed(2)} USDC`
                    : "—"
                } · ${
                  userCngnBalance !== null
                    ? `${userCngnBalance.toFixed(2)} cNGN`
                    : "—"
                }`
              : userUsdcBalance !== null
              ? `${userUsdcBalance.toFixed(2)} ${rwaConfig.payoutSymbol}`
              : "—"}
            {userSolBalance !== null && (
              <span
                className="text-muted-foreground ml-1.5"
                title="Solana balance"
              >
                · {userSolBalance.toFixed(3)} SOL
              </span>
            )}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
          <div>
            <span className="text-xs text-muted-foreground">Holding</span>
            <p className="text-2xl font-bold">
              {userRwaShares !== null
                ? `${userRwaShares.toFixed(4)} ${rwaConfig.symbol}`
                : "0.0000"}
            </p>
            <p className="text-xs text-muted-foreground">
              Est. Value: {rwaConfig.payoutSymbol === "cNGN" ? "₦" : "$"}
              {holdingsValue.toFixed(2)} {rwaConfig.payoutSymbol}
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              className="flex-1 sm:flex-none rounded-full px-6 font-semibold"
              onClick={() => onOpenTrade("buy")}
            >
              Buy {rwaConfig.symbol}
            </Button>
            <Button
              variant="outline"
              className="flex-1 sm:flex-none rounded-full px-6 font-semibold"
              disabled={!userRwaShares || userRwaShares <= 0}
              onClick={() => onOpenTrade("sell")}
            >
              Sell
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};
