import { PajTransaction } from "paj_ramp";
import { ExternalLink } from "lucide-react";

export interface TransactionRow {
  id: number | string;
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

const shortenAddress = (addr: string): string => {
  if (!addr) return "";
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
};

const getExplorerUrl = (txSignature: string | null | undefined, chainType?: string): string | null => {
  if (!txSignature) return null;
  if (txSignature.startsWith("ord_") || txSignature.length < 20) return null;
  const isArc = chainType?.toLowerCase() === "arc" || txSignature.startsWith("0x");
  if (isArc) {
    return `https://explorer.arc.io/tx/${txSignature}`;
  }
  return `https://solscan.io/tx/${txSignature}`;
};

const formatAmount = (val: string | number | undefined | null): string => {
  if (val == null || val === "") return "0";
  const num = typeof val === "number" ? val : parseFloat(String(val));
  if (isNaN(num)) return String(val);
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  });
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
                const isOfframp = tx.source === "offramp";
                const isOnramp = tx.source === "onramp";
                const isArc = tx.chainType?.toLowerCase() === "arc";
                const explorerUrl = getExplorerUrl(tx.txSignature, tx.chainType);

                let actionLabel = tx.direction === "incoming" ? "Received" : "Sent";
                if (isOfframp) actionLabel = "Bank Off-Ramp";
                if (isOnramp) actionLabel = "Fiat On-Ramp";

                return (
                  <div key={`tx-${tx.id}-${idx}`} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl bg-secondary/30 text-sm border border-border/40 hover:border-primary/30 transition-all duration-200">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={
                          isOfframp
                            ? "text-amber-500 font-bold"
                            : tx.direction === "incoming"
                            ? "text-emerald-500 font-bold"
                            : "text-rose-500 font-bold"
                        }>
                          {actionLabel}
                        </span>
                        <span className="font-mono text-base font-medium">{formatAmount(tx.amount)} {tx.assetSymbol}</span>
                        {isArc ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                            Arc
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                            Solana
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground opacity-80 space-y-0.5">
                        <div>
                          <span className="font-medium text-foreground/70">From:</span>{" "}
                          <span className="font-mono">
                            {formatVaultLabel(tx.fromAddress).startsWith("0x") || formatVaultLabel(tx.fromAddress).length > 20
                              ? shortenAddress(formatVaultLabel(tx.fromAddress))
                              : formatVaultLabel(tx.fromAddress)}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium text-foreground/70">To:</span>{" "}
                          <span className="font-mono">
                            {formatVaultLabel(tx.toAddress).startsWith("0x") || formatVaultLabel(tx.toAddress).length > 20
                              ? shortenAddress(formatVaultLabel(tx.toAddress))
                              : formatVaultLabel(tx.toAddress)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 sm:mt-0 sm:text-right text-xs text-muted-foreground space-y-1">
                      <div className="font-semibold text-foreground/90">{itemDate}</div>
                      <div className="flex items-center sm:justify-end gap-1.5 flex-wrap">
                        <span className="uppercase tracking-widest text-[10px] font-bold opacity-60">
                          {isOfframp ? "Bank Withdrawal" : isOnramp ? "Fiat Deposit" : tx.source === "onchain" ? "On-chain Transfer" : `${isArc ? "Arc" : "Solana"} Transfer`}
                        </span>
                        {explorerUrl && (
                          <a
                            href={explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 text-[10px] text-primary/80 hover:text-primary transition-colors underline"
                            title="View on Explorer"
                          >
                            <span>View</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
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
                        <span className="font-mono text-base font-medium">{formatAmount(sa.amount)} USDC</span>
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
                const ftChain = (ft as any).chain ? String((ft as any).chain).toUpperCase() : "";
                const ftMint = (ft as any).mint ? String((ft as any).mint).toLowerCase() : "";
                const isArc = ftChain === "ARC" || ftMint === "0x3600000000000000000000000000000000000000";
                const txHash = (ft as any).signature || (ft as any).txHash || (ft as any).transactionHash;
                const explorerUrl = txHash ? getExplorerUrl(txHash, isArc ? "arc" : "solana") : null;

                return (
                  <div key={`ft-${ft.id}-${idx}`} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl bg-orange-500/5 text-sm border border-orange-500/20 hover:border-orange-500/40 transition-all duration-200">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={isBuy ? "text-emerald-500 font-bold" : "text-amber-500 font-bold"}>
                          {isBuy ? "Bought USDC (Fiat)" : "Sold USDC (Fiat)"}
                        </span>
                        <span className="font-mono text-base font-medium">{formatAmount(ft.usdcAmount ?? ft.amount)} USDC</span>
                        {isArc ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                            Arc
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                            Solana
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground opacity-80 space-y-0.5">
                        <div><span className="font-medium text-foreground/70">Fiat Amount:</span> {(ft as any).currency ? `${(ft as any).currency} ` : "₦"}{formatAmount(ft.fiatAmount ?? ft.amount)}</div>
                        {(ft as any).rate && <div><span className="font-medium text-foreground/70">Rate:</span> {formatAmount((ft as any).rate)} {(ft as any).currency || "NGN"}/USDC</div>}
                        <div>
                          <span className="font-medium text-foreground/70">Status:</span>{" "}
                          <span className={
                            ft.status === "COMPLETED" || ft.status === "SUCCESSFUL"
                              ? "text-emerald-400 font-medium"
                              : ft.status === "PENDING" || ft.status === "INIT"
                              ? "text-amber-400 font-medium"
                              : "text-muted-foreground"
                          }>
                            {ft.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 sm:mt-0 sm:text-right text-xs text-muted-foreground space-y-1">
                      <div className="font-semibold text-foreground/90">{itemDate}</div>
                      <div className="flex items-center sm:justify-end gap-1.5 flex-wrap">
                        <div className="uppercase tracking-widest text-[10px] font-bold opacity-60">Fiat {isBuy ? "Deposit" : "Withdrawal"}</div>
                        {explorerUrl && (
                          <a
                            href={explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 text-[10px] text-primary/80 hover:text-primary transition-colors underline"
                            title="View on Explorer"
                          >
                            <span>View</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
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
                        <span className="font-mono text-base font-medium">{formatAmount(sh.usdcAmount)} USDC</span>
                      </div>
                      <div className="text-xs text-muted-foreground opacity-80">
                        <div><span className="font-medium text-foreground/70">Asset:</span> {sh.stockName}</div>
                        {sh.sharesAmount && <div><span className="font-medium text-foreground/70">Shares:</span> {formatAmount(sh.sharesAmount)}</div>}
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
