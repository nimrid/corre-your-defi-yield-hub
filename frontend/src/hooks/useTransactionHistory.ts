import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/services/apiClient";
import { getAllTransactions } from "paj_ramp";
import type { PajTransaction } from "paj_ramp";
import type {
  TransactionRow,
  StockHistoryRow,
  SavingsActivityRow,
} from "@/components/dashboard/TransactionHistory";

export interface TransactionHistoryData {
  transactions: TransactionRow[];
  savingsActivity: SavingsActivityRow[];
  stockHistory: StockHistoryRow[];
  privateMarketHistory: any[];
  fiatTransactions: PajTransaction[];
}

export function useTransactionHistory(
  userId: string | undefined,
  primarySolanaAddress: string | undefined,
  sessionToken: string | null
) {
  return useQuery<TransactionHistoryData>({
    queryKey: ["transactionHistory", userId, primarySolanaAddress, sessionToken],
    enabled: !!userId, // Only run query when userId is available
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!userId) {
        return {
          transactions: [],
          savingsActivity: [],
          stockHistory: [],
          privateMarketHistory: [],
          fiatTransactions: [],
        };
      }

      // 1. Fetch DB transactions
      const txPromise = (async () => {
        try {
          const res = await apiFetch(`/transactions/${userId}`);
          if (!res.ok) return [];
          const data = await res.json();
          const dbTransactions: TransactionRow[] = Array.isArray(data) ? data : [];

          // Fetch on-chain USDC transfer history via Helius if Solana address is present
          let onchainTransactions: TransactionRow[] = [];
          if (primarySolanaAddress) {
            try {
              const onchainRes = await apiFetch(`/transactions/onchain/${primarySolanaAddress}`);
              if (onchainRes.ok) {
                const onchainData = await onchainRes.json();
                onchainTransactions = Array.isArray(onchainData) ? onchainData : [];
              }
            } catch (err) {
              console.warn("Failed to fetch on-chain transactions:", err);
            }
          }

          const dbSignatures = new Set(
            dbTransactions.map((tx) => tx.txSignature).filter(Boolean)
          );
          const uniqueOnchain = onchainTransactions.filter(
            (tx) => !tx.txSignature || !dbSignatures.has(tx.txSignature)
          );

          return [...dbTransactions, ...uniqueOnchain];
        } catch (err) {
          console.error("Error fetching transfers:", err);
          return [];
        }
      })();

      // 2. Fetch savings activity
      const savingsPromise = (async () => {
        try {
          const res = await apiFetch(`/savings-activity/${userId}`);
          if (!res.ok) return [];
          const data = await res.json();
          return Array.isArray(data) ? (data as SavingsActivityRow[]) : [];
        } catch (err) {
          console.error("Error fetching savings activity:", err);
          return [];
        }
      })();

      // 3. Fetch stock history
      const stockPromise = (async () => {
        try {
          const res = await apiFetch(`/stock-history/${userId}`);
          if (!res.ok) return [];
          const data = await res.json();
          return Array.isArray(data) ? (data as StockHistoryRow[]) : [];
        } catch (err) {
          console.error("Error fetching stock history:", err);
          return [];
        }
      })();

      // 4. Fetch private market history
      const privateMarketPromise = (async () => {
        try {
          const res = await apiFetch(`/investments/private-market/history/${userId}`);
          if (!res.ok) return [];
          const data = await res.json();
          return Array.isArray(data) ? data : [];
        } catch (err) {
          console.error("Error fetching private market history:", err);
          return [];
        }
      })();

      // 5. Fetch fiat transactions
      const fiatPromise = (async () => {
        if (!sessionToken) return [];
        try {
          const data = await getAllTransactions(sessionToken);
          return Array.isArray(data) ? data : [];
        } catch (err) {
          console.error("Error fetching fiat transactions:", err);
          return [];
        }
      })();

      const [
        transactions,
        savingsActivity,
        stockHistory,
        privateMarketHistory,
        fiatTransactions,
      ] = await Promise.all([
        txPromise,
        savingsPromise,
        stockPromise,
        privateMarketPromise,
        fiatPromise,
      ]);

      return {
        transactions,
        savingsActivity,
        stockHistory,
        privateMarketHistory,
        fiatTransactions,
      };
    },
  });
}

/**
 * Helper hook to invalidate or refresh transaction history cache
 * Call `invalidate()` whenever a user completes a transaction!
 */
export function useInvalidateTransactionHistory() {
  const queryClient = useQueryClient();
  return () => {
    return queryClient.invalidateQueries({ queryKey: ["transactionHistory"] });
  };
}
