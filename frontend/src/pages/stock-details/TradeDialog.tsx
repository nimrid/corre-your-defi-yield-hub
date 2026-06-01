import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { useTradeDialog } from "./useTradeDialog";

interface TradeDialogProps {
  /** Return value of useTradeDialog */
  trade: ReturnType<typeof useTradeDialog>;
  tokenSymbol: string | undefined;
  /** e.g. "4,230.12 USDC" or "12.5 TSLA" */
  availableLabel: string;
  /** "buy" | "sell" */
  direction: "buy" | "sell";
}

export default function TradeDialog({ trade, tokenSymbol, availableLabel, direction }: TradeDialogProps) {
  const isBuy = direction === "buy";

  return (
    <Dialog open={trade.open} onOpenChange={trade.setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isBuy ? "Buy" : "Sell"} {tokenSymbol}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground flex items-center justify-between">
            <span>{isBuy ? "Pay with USDC" : "Sell shares"}</span>
            <span>Available: {availableLabel}</span>
          </div>
          <div className="space-y-2">
            <Input
              type="number"
              min="0"
              step="0.000001"
              inputMode="decimal"
              placeholder="0.00"
              value={trade.input}
              onChange={(e) => trade.setInput(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {isBuy
                ? `Enter the amount of USDC you want to invest in ${tokenSymbol}. Minimum: $5.00`
                : `Enter the amount of ${tokenSymbol} you want to sell for USDC.`}
            </p>
          </div>

          <div className="rounded-xl bg-secondary/40 border border-border/60 p-3 text-sm space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {isBuy ? "Estimated shares" : "Estimated USDC"}
              </span>
              <span className="font-semibold">
                {trade.quoteLoading
                  ? "Calculating..."
                  : trade.outAmount != null
                  ? `${trade.outAmount} ${isBuy ? tokenSymbol : "USDC"}`
                  : "-"}
              </span>
            </div>
            {trade.quoteError && (
              <p className="text-xs text-red-500 break-words">{trade.quoteError}</p>
            )}
            {trade.executeError && !trade.quoteError && (
              <p className="text-xs text-red-500 break-words">{trade.executeError}</p>
            )}
            {trade.executeSuccess && (
              <p className="text-xs text-emerald-500 break-words">{trade.executeSuccess}</p>
            )}
          </div>

          <Button
            type="button"
            className="w-full rounded-full font-semibold"
            disabled={
              !trade.outAmount ||
              trade.quoteLoading ||
              trade.executeLoading ||
              !trade.unsignedTx ||
              !trade.requestId
            }
            onClick={trade.handleExecute}
          >
            {trade.executeLoading
              ? "Confirming..."
              : isBuy
              ? "Confirm buy"
              : "Confirm sell"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
