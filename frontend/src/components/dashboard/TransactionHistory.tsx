import { PajTransaction } from "paj_ramp";

export interface TransactionRow {
  id: number;
  chainType: string;
  assetSymbol: string;
  amount: string;
  direction: "incoming" | "outgoing";
  txSignature?: string | null;
  fromAddress: string;
  toAddress: string;
  source?: string | null;
  createdAt: string;
}

export interface StockHistoryRow {
  id: number;
  stockMint: string;
  stockSymbol: string | null;
  stockName: string | null;
  usdcAmount: string;
  sharesAmount: string | null;
  walletAddress: string | null;
  txSignature: string | null;
  jupiterRequestId: string | null;
  source: string | null;
  createdAt: string;
  side: "buy" | "sell";
}

export interface SavingsActivityRow {
  id: number;
  vaultType: "regular" | "protected";
  direction: "deposit" | "withdrawal";
  amount: string;
  walletAddress: string | null;
  txSignature: string | null;
  source: string | null;
  createdAt: string;
}

const formatVaultLabel = (value: string): string => {
  if (value === "lulo_vault_regular") {
    return "Standard savings vault";
  }
  if (value === "lulo_vault_protected") {
    return "Shielded savings vault";
  }
  return value;
};

interface TransactionHistoryProps {
  transactions: TransactionRow[];
  savingsActivity: SavingsActivityRow[];
  stockHistory: StockHistoryRow[];
  fiatTransactions: PajTransaction[];
  privateMarketHistory: any[];
  txLoading: boolean;
  savingsLoading: boolean;
  fiatLoading: boolean;
  txError: string | null;
  savingsError: string | null;
  fiatError: string | null;
}

export const TransactionHistory = ({
  transactions,
  savingsActivity,
  stockHistory,
  fiatTransactions,
  privateMarketHistory,
  txLoading,
  savingsLoading,
  fiatLoading,
  txError,
  savingsError,
  fiatError,
}: TransactionHistoryProps) => {
  return (
    <div className="glass-card p-6 order-4">
      <h2 className="text-2xl font-semibold mb-4">Transaction History</h2>
      {txLoading || savingsLoading || fiatLoading ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>Loading transactions...</p>
        </div>
      ) : txError || savingsError || fiatError ? (
        <div className="text-center py-8 text-red-500 text-sm">
          <p>{txError || savingsError || fiatError}</p>
        </div>
      ) : !transactions.length && !savingsActivity.length && !stockHistory.length && !fiatTransactions.length && !privateMarketHistory.filter(pm => pm.status === "CONFIRMED").length ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No transactions yet.</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {/* Combine and sort transactions and savings activity by date */}
          {[
            ...transactions.map((tx) => ({
              ...tx,
              type: "transfer" as const,
              sortDate: new Date(tx.createdAt).getTime(),
            })),
            ...savingsActivity.map((sa) => ({
              ...sa,
              type: "savings" as const,
              sortDate: new Date(sa.createdAt).getTime(),
            })),
            ...stockHistory.map((sh) => ({
              ...sh,
              type: "stock" as const,
              sortDate: new Date(sh.createdAt).getTime(),
            })),
            ...fiatTransactions.map((ft) => ({
              ...ft,
              type: "fiat" as const,
              sortDate: new Date(ft.createdAt || Date.now()).getTime(),
            })),
            ...privateMarketHistory.filter(pm => pm.status === "CONFIRMED").map((pm) => ({
              ...pm,
              type: "private_market" as const,
              sortDate: new Date(pm.createdAt).getTime(),
            })),
          ]
            .sort((a, b) => b.sortDate - a.sortDate)
            .map((item, idx) => {
              const itemDate = new Date((item as any).createdAt || Date.now()).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              });

              if (item.type === "transfer") {
                const tx = item as TransactionRow;
                return (
                  <div key={`tx-${tx.id}-${idx}`} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl bg-secondary/30 text-sm border border-border/40 hover:border-primary/30 transition-all duration-200">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={tx.direction === "incoming" ? "text-emerald-500 font-bold" : "text-red-500 font-bold"}>
                          {tx.direction === "incoming" ? "Received" : "Sent"}
                        </span>
                        <span className="font-mono text-base font-medium">{tx.amount} {tx.assetSymbol}</span>
                      </div>
                      <div className="text-xs text-muted-foreground opacity-80">
                        <div><span className="font-medium text-foreground/70">From:</span> {formatVaultLabel(tx.fromAddress)}</div>
                        <div><span className="font-medium text-foreground/70">To:</span> {formatVaultLabel(tx.toAddress)}</div>
                      </div>
                    </div>
                    <div className="mt-2 sm:mt-0 sm:text-right text-xs text-muted-foreground space-y-1">
                      <div className="font-semibold text-foreground/90">{itemDate}</div>
                      <div className="uppercase tracking-widest text-[10px] font-bold opacity-60">{tx.source === "offramp" ? "Bank Transfer" : tx.source === "onchain" ? "On-chain Transfer" : `${tx.chainType} Transfer`}</div>
                    </div>
                  </div>
                );
              } else if (item.type === "savings") {
                const sa = item as SavingsActivityRow;
                return (
                  <div key={`sa-${sa.id}-${idx}`} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl bg-blue-500/5 text-sm border border-blue-500/20 hover:border-blue-500/40 transition-all duration-200">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={sa.direction === "deposit" ? "text-blue-500 font-bold" : "text-orange-500 font-bold"}>
                          {sa.direction === "deposit" ? "Savings Deposit" : "Savings Withdrawal"}
                        </span>
                        <span className="font-mono text-base font-medium">{sa.amount} USDC</span>
                      </div>
                      <div className="text-xs text-muted-foreground opacity-80">
                        <span className="font-medium text-foreground/70">Vault:</span> {sa.vaultType === "regular" ? "Standard Yield" : "Shielded Yield"}
                      </div>
                    </div>
                    <div className="mt-2 sm:mt-0 sm:text-right text-xs text-muted-foreground space-y-1">
                      <div className="font-semibold text-foreground/90">{itemDate}</div>
                    </div>
                  </div>
                );
              } else if (item.type === "fiat") {
                const ft = item as PajTransaction;
                const isBuy = ft.transactionType === "ON_RAMP";
                return (
                  <div key={`ft-${ft.id}-${idx}`} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl bg-orange-500/5 text-sm border border-orange-500/20 hover:border-orange-500/40 transition-all duration-200">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={isBuy ? "text-emerald-500 font-bold" : "text-orange-500 font-bold"}>
                          {isBuy ? "Bought USDC (Fiat)" : "Sold USDC (Fiat)"}
                        </span>
                        <span className="font-mono text-base font-medium">{ft.usdcAmount ?? ft.amount} USDC</span>
                      </div>
                      <div className="text-xs text-muted-foreground opacity-80">
                        <div><span className="font-medium text-foreground/70">Fiat Amount:</span> {(ft as any).currency ? `${(ft as any).currency} ` : "₦"}{(ft.fiatAmount ?? ft.amount)?.toLocaleString()}</div>
                        {(ft as any).rate && <div><span className="font-medium text-foreground/70">Rate:</span> {(ft as any).rate} {(ft as any).currency || "NGN"}/USDC</div>}
                        <div><span className="font-medium text-foreground/70">Status:</span> {ft.status}</div>
                      </div>
                    </div>
                    <div className="mt-2 sm:mt-0 sm:text-right text-xs text-muted-foreground space-y-1">
                      <div className="font-semibold text-foreground/90">{itemDate}</div>
                      <div className="uppercase tracking-widest text-[10px] font-bold opacity-60">Fiat {isBuy ? "Deposit" : "Withdrawal"}</div>
                    </div>
                  </div>
                );
              } else if (item.type === "stock") {
                const sh = item as StockHistoryRow;
                return (
                  <div key={`sh-${sh.id}-${idx}`} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl bg-purple-500/5 text-sm border border-purple-500/20 hover:border-purple-500/40 transition-all duration-200">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={sh.side === "buy" ? "text-purple-500 font-bold" : "text-rose-500 font-bold"}>
                          {sh.side === "buy" ? "Bought" : "Sold"} {sh.stockSymbol}
                        </span>
                        <span className="font-mono text-base font-medium">{sh.usdcAmount} USDC</span>
                      </div>
                      <div className="text-xs text-muted-foreground opacity-80">
                        <div><span className="font-medium text-foreground/70">Asset:</span> {sh.stockName}</div>
                        {sh.sharesAmount && <div><span className="font-medium text-foreground/70">Shares:</span> {sh.sharesAmount}</div>}
                      </div>
                    </div>
                    <div className="mt-2 sm:mt-0 sm:text-right text-xs text-muted-foreground space-y-1">
                      <div className="font-semibold text-foreground/90">{itemDate}</div>
                    </div>
                  </div>
                );
              } else if (item.type === "private_market") {
                const pm = item as any;
                return (
                  <div key={`pm-${pm.id}-${idx}`} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl bg-green-500/5 text-sm border border-green-500/20 hover:border-green-500/40 transition-all duration-200">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-green-500 font-bold">
                          Invested in Private Market
                        </span>
                        <span className="font-mono text-base font-medium">₦{Number(pm.amount).toLocaleString()}</span>
                      </div>
                      <div className="text-xs text-muted-foreground opacity-80">
                        <div><span className="font-medium text-foreground/70">Asset:</span> {pm.investmentId === "nilep-palm-oil" ? "Palm Oil Mill Operations" : pm.investmentId}</div>
                        {pm.expectedShares && <div><span className="font-medium text-foreground/70">Expected Share:</span> {pm.expectedShares}%</div>}
                      </div>
                    </div>
                    <div className="mt-2 sm:mt-0 sm:text-right text-xs text-muted-foreground space-y-1">
                      <div className="font-semibold text-foreground/90">{itemDate}</div>
                    </div>
                  </div>
                );
              }
              
              return null;
            })}
        </div>
      )}
    </div>
  );
};
