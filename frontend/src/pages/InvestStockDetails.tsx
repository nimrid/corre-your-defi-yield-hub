import Navigation from "@/components/Navigation";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { usePrivy } from "@privy-io/react-auth";
import {
  useWallets as useSolanaWallets,
  useSignTransaction,
} from "@privy-io/react-auth/solana";

import { STAT_BLOCKS } from "./stock-details/stockDetailsUtils";
import { useTokenDetails } from "./stock-details/useTokenDetails";
import { useHoldings } from "./stock-details/useHoldings";
import { useTradeDialog } from "./stock-details/useTradeDialog";
import StockHeader from "./stock-details/StockHeader";
import StockEnrichment from "./stock-details/StockEnrichment";
import TradeDialog from "./stock-details/TradeDialog";

const InvestStockDetails = () => {
  const { t } = useTranslation();
  const { mint } = useParams<{ mint: string }>();
  const navigate = useNavigate();
  const { user } = usePrivy();
  const { wallets } = useSolanaWallets();
  const { signTransaction } = useSignTransaction();

  // Debug: log available Solana wallets in development only
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[InvestStockDetails] Solana wallets", wallets);
  }

  // ── Data hooks ──────────────────────────────────────────────────────────────
  const {
    token,
    loading,
    error,
    tokensAsset,
    tokensPriceChart,
    tokensLoading,
    chartLastUpdated,
    chartRefreshing,
    latestChartPrice,
  } = useTokenDetails(mint);

  const {
    userShares,
    setUserShares,
    sharesLoading,
    usdcBalance,
    usdcBalanceRaw,
  } = useHoldings(token, user, wallets, mint);

  // ── Trade hooks ─────────────────────────────────────────────────────────────
  const buyTrade = useTradeDialog({
    direction: "buy",
    token,
    wallets,
    signTransaction,
    user,
    usdcBalanceRaw,
    userShares,
    setUserShares,
  });

  const sellTrade = useTradeDialog({
    direction: "sell",
    token,
    wallets,
    signTransaction,
    user,
    usdcBalanceRaw,
    userShares,
    setUserShares,
  });

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-24 space-y-6">
        <button
          type="button"
          onClick={() => navigate("/invest/us-stocks")}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t("invest_stock_details.back_to_us_stocks")}</span>
        </button>

        <div className="glass-card p-6 sm:p-8 rounded-2xl space-y-6">
          {loading && (
            <p className="text-sm text-muted-foreground">{t("invest_stock_details.loading")}</p>
          )}

          {error && !loading && (
            <p className="text-sm text-red-500 break-words">{error}</p>
          )}

          {!loading && !error && token && (
            <>
              <StockHeader
                token={token}
                tokensAsset={tokensAsset}
                latestChartPrice={latestChartPrice}
              />

              <StockEnrichment
                token={token}
                tokensAsset={tokensAsset}
                tokensLoading={tokensLoading}
                tokensPriceChart={tokensPriceChart}
                chartLastUpdated={chartLastUpdated}
                chartRefreshing={chartRefreshing}
                statBlocks={STAT_BLOCKS}
              >
                {/* User holdings */}
                <div className="rounded-xl bg-secondary/40 border border-border/60 p-3 flex flex-col text-sm">
                  <span className="text-xs text-muted-foreground">{t("invest_stock_details.your_holdings")}</span>
                  <span className="mt-1 font-semibold">
                    {sharesLoading
                      ? "Checking..."
                      : userShares != null && Number(userShares) > 0
                      ? (
                          <div className="flex flex-col">
                            <span>{Number(userShares).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} shares</span>
                            <span className="text-muted-foreground text-xs font-normal mt-0.5">
                              ≈ ${(Number(userShares) * (tokensAsset?.price ?? latestChartPrice ?? token.usdPrice ?? 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
                            </span>
                          </div>
                        )
                      : "No shares detected"}
                  </span>
                </div>

                {/* Actions */}
                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <Button
                    type="button"
                    className="flex-1 rounded-full font-semibold"
                    variant="default"
                    onClick={buyTrade.openDialog}
                  >
                    {t("invest_stock_details.buy")}
                  </Button>
                  <Button
                    type="button"
                    className="flex-1 rounded-full font-semibold"
                    variant="default"
                    onClick={sellTrade.openDialog}
                  >
                    {t("invest_stock_details.sell")}
                  </Button>
                </div>
              </StockEnrichment>
            </>
          )}
        </div>
      </main>

      {/* Trade dialogs */}
      <TradeDialog
        trade={buyTrade}
        tokenSymbol={token?.symbol}
        direction="buy"
        availableLabel={
          sharesLoading
            ? "Checking..."
            : usdcBalance != null
            ? `${usdcBalance} USDC`
            : "0 USDC"
        }
      />
      <TradeDialog
        trade={sellTrade}
        tokenSymbol={token?.symbol}
        direction="sell"
        availableLabel={
          sharesLoading
            ? "Checking..."
            : userShares != null
            ? `${userShares} ${token?.symbol}`
            : `0 ${token?.symbol}`
        }
      />
    </div>
  );
};

export default InvestStockDetails;
