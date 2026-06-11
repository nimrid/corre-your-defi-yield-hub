import { useState, useCallback } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/services/apiClient";
import { base64ToUint8Array, uint8ArrayToBase64, USDC_MINT, type TokenDetails } from "./stockDetailsUtils";

export type TradeDirection = "buy" | "sell";

export interface TradeDialogState {
  open: boolean;
  input: string;
  quoteLoading: boolean;
  quoteError: string | null;
  outAmount: string | null;
  outAmountRaw: string | null;
  requestId: string | null;
  unsignedTx: string | null;
  lastValidBlockHeight: string | null;
  executeLoading: boolean;
  executeError: string | null;
  executeSuccess: string | null;
}

interface UseTradeDialogOptions {
  direction: TradeDirection;
  token: TokenDetails | null;
  wallets: any[];
  signTransaction: any;
  user: { id: string } | null;
  usdcBalanceRaw: number | null;
  userShares: string | null;
  setUserShares: React.Dispatch<React.SetStateAction<string | null>>;
}

const INITIAL_STATE: Omit<TradeDialogState, "open" | "input"> = {
  quoteLoading: false,
  quoteError: null,
  outAmount: null,
  outAmountRaw: null,
  requestId: null,
  unsignedTx: null,
  lastValidBlockHeight: null,
  executeLoading: false,
  executeError: null,
  executeSuccess: null,
};

/**
 * Unified hook for both Buy and Sell trade flows.
 *
 * Parameterised by `direction`:
 * - "buy"  → inputMint=USDC, outputMint=token, decimals conversion on output
 * - "sell" → inputMint=token, outputMint=USDC, decimals conversion on input
 */
export function useTradeDialog(opts: UseTradeDialogOptions) {
  const { direction, token, wallets, signTransaction, user, usdcBalanceRaw, userShares, setUserShares } = opts;

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [state, setState] = useState(INITIAL_STATE);

  const resetQuoteState = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const openDialog = useCallback(() => {
    setOpen(true);
    setInput("");
    resetQuoteState();
  }, [resetQuoteState]);

  // ── Resolve taker address ─────────────────────────────────────────────────
  const resolveTaker = useCallback(async (): Promise<string | undefined> => {
    const solWallet = wallets[0] as any;
    let takerAddress: string | undefined = solWallet?.address;
    if (!takerAddress && solWallet && typeof solWallet.getAddress === "function") {
      try {
        takerAddress = await solWallet.getAddress();
      } catch {
        takerAddress = undefined;
      }
    }
    return takerAddress;
  }, [wallets]);

  // ── Resolve owner address (for backend logging) ───────────────────────────
  const resolveOwnerAddress = useCallback(async (): Promise<string | undefined> => {
    const solWallet = wallets.find(
      (w: any) =>
        w.walletClientType === "solana" ||
        w.chainType === "solana" ||
        w.chain === "solana"
    ) as any;

    let ownerAddress: string | undefined = solWallet?.address;
    if (!ownerAddress && solWallet && typeof solWallet.getAddress === "function") {
      try {
        ownerAddress = await solWallet.getAddress();
      } catch {
        ownerAddress = undefined;
      }
    }
    return ownerAddress;
  }, [wallets]);

  // ── Handle input change (triggers quote) ──────────────────────────────────
  const handleInputChange = useCallback(
    async (value: string) => {
      setInput(value);
      setState(INITIAL_STATE);

      const parsed = Number(value);
      if (!token || !value || Number.isNaN(parsed) || parsed <= 0) return;

      // Validation
      if (direction === "buy") {
        if (parsed < 5) {
          setState((s) => ({ ...s, quoteError: "Minimum investment is $5. Please enter an amount of at least $5." }));
          return;
        }
        if (usdcBalanceRaw !== null && parsed > usdcBalanceRaw) {
          setState((s) => ({
            ...s,
            quoteError: `Insufficient USDC balance. You have ${usdcBalanceRaw.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC available.`,
          }));
          return;
        }
      } else {
        if (userShares == null || Number(userShares) <= 0) {
          setState((s) => ({ ...s, quoteError: "You do not hold any shares of this stock to sell." }));
          return;
        }
        if (parsed > Number(userShares)) {
          setState((s) => ({
            ...s,
            quoteError: `Insufficient shares. You only have ${Number(userShares).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${token.symbol}.`,
          }));
          return;
        }
      }

      const apiKey = import.meta.env.VITE_JUP_API_KEY as string | undefined;
      if (!apiKey) return;

      try {
        setState((s) => ({ ...s, quoteLoading: true }));

        const takerAddress = await resolveTaker();
        if (!takerAddress) {
          setState((s) => ({ ...s, quoteError: "No Solana wallet found for taker", quoteLoading: false }));
          return;
        }

        // Determine mints and amount conversion
        let inputMint: string;
        let outputMint: string;
        let rawAmount: number;

        if (direction === "buy") {
          inputMint = USDC_MINT;
          outputMint = token.address;
          rawAmount = Math.round(parsed * 1_000_000); // USDC has 6 decimals
        } else {
          inputMint = token.address;
          outputMint = USDC_MINT;
          const sellDecimals =
            typeof token.decimals === "number" && !Number.isNaN(token.decimals)
              ? token.decimals
              : 6;
          rawAmount = Math.round(parsed * 10 ** sellDecimals);
        }

        const base = "https://api.jup.ag/swap/v2/order";
        const params = new URLSearchParams({
          inputMint,
          outputMint,
          amount: String(rawAmount),
          taker: takerAddress,
          referralAccount: "5VAt8EHw6jQuSC3X2ezTZDmF9pfLrLnoZLbVwMP7B8Ga",
          referralFee: "100",
        });
        const url = `${base}?${params.toString()}`;

        const res = await fetch(url, {
          method: "GET",
          headers: { "x-api-key": apiKey },
        });

        const data: any = await res.json().catch(() => null);
        if (import.meta.env.DEV) {
          console.debug(`[InvestStockDetails] ${direction} order response`, { status: res.status, data });
        }

        if (!res.ok) {
          const apiMsg = data?.error ?? data?.message ?? data?.detail ?? `Jupiter API error ${res.status}`;
          throw new Error(apiMsg);
        }

        if (data?.error || data?.message) {
          throw new Error(data?.error ?? data?.message);
        }

        const rawOutStr = data?.outAmount as string | undefined;
        const tx = data?.transaction as string | undefined;
        const reqId = data?.requestId as string | undefined;
        const lvbh = data?.lastValidBlockHeight != null ? String(data.lastValidBlockHeight) : null;

        if (!rawOutStr || !tx || !reqId) {
          const missing = [!rawOutStr && "outAmount", !tx && "transaction", !reqId && "requestId"]
            .filter(Boolean)
            .join(", ");
          setState((s) => ({
            ...s,
            quoteError: `Incomplete quote response (missing: ${missing}). Token may not be tradeable via this route.`,
            outAmount: null,
            outAmountRaw: null,
            requestId: null,
            unsignedTx: null,
            lastValidBlockHeight: null,
          }));
          return;
        }

        // Convert outAmount from base units
        let outNumber: number;
        if (direction === "buy") {
          const buyDecimals =
            typeof token.decimals === "number" && !Number.isNaN(token.decimals)
              ? token.decimals
              : 6;
          outNumber = Number(rawOutStr) / 10 ** buyDecimals;
        } else {
          outNumber = Number(rawOutStr) / 1_000_000; // USDC always 6 decimals
        }

        setState((s) => ({
          ...s,
          outAmount: outNumber.toLocaleString(undefined, { maximumFractionDigits: 6 }),
          outAmountRaw: String(outNumber),
          unsignedTx: tx,
          requestId: reqId,
          lastValidBlockHeight: lvbh,
        }));
      } catch (err: any) {
        console.error(`[InvestStockDetails] ${direction} quote error`, err);
        setState((s) => ({ ...s, quoteError: err?.message ?? "Failed to get quote" }));
      } finally {
        setState((s) => ({ ...s, quoteLoading: false }));
      }
    },
    [token, direction, usdcBalanceRaw, userShares, resolveTaker],
  );

  // ── Execute trade ─────────────────────────────────────────────────────────
  const handleExecute = useCallback(async () => {
    if (!state.unsignedTx || !state.requestId || !token) return;

    const apiKey = import.meta.env.VITE_JUP_API_KEY as string | undefined;
    if (!apiKey) {
      setState((s) => ({ ...s, executeError: "API key is not configured" }));
      return;
    }

    try {
      setState((s) => ({ ...s, executeLoading: true, executeError: null, executeSuccess: null }));

      const solWallet = wallets[0] as any;
      const takerAddress = await resolveTaker();

      if (!solWallet || !takerAddress) {
        setState((s) => ({ ...s, executeError: "No Solana wallet available to sign transaction", executeLoading: false }));
        return;
      }

      const { VersionedTransaction } = await import("@solana/web3.js");
      const txBytes = base64ToUint8Array(state.unsignedTx!);
      const transaction = VersionedTransaction.deserialize(txBytes);

      if (import.meta.env.DEV) {
        console.debug(`[InvestStockDetails] Signing ${direction} transaction`, {
          unsignedLength: txBytes.length,
          walletAddress: takerAddress,
        });
      }

      if (!signTransaction) {
        setState((s) => ({ ...s, executeError: "Sign transaction functionality is not available", executeLoading: false }));
        return;
      }

      const serializedTx = transaction.serialize();
      const signResult: any = await signTransaction({
        transaction: new Uint8Array(serializedTx),
        wallet: solWallet,
      });

      const signedBytes: Uint8Array = signResult?.signedTransaction ?? signResult;
      const signedBase64 = uint8ArrayToBase64(signedBytes);

      const res = await fetch("https://api.jup.ag/swap/v2/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          signedTransaction: signedBase64,
          requestId: state.requestId,
          lastValidBlockHeight: state.lastValidBlockHeight ?? undefined,
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to execute ${direction} order: ${res.status}`);
      }
      const execData: any = await res.json().catch(() => null);

      if (import.meta.env.DEV) {
        console.debug(`[InvestStockDetails] ${direction} execute response`, execData);
      }

      setState((s) => ({
        ...s,
        executeSuccess: direction === "buy" ? "Order submitted successfully" : "Sell order submitted successfully",
      }));
      toast.success(direction === "buy" ? "Trade executed successfully" : "Stock sold successfully");

      // ── Fire-and-forget backend logging ─────────────────────────────────
      const privyUserId = user?.id;
      if (privyUserId) {
        const ownerAddress = await resolveOwnerAddress();
        const signature = (execData as any)?.signature ?? (execData as any)?.txid ?? null;
        const formattedOutAmountRaw = state.outAmountRaw ? Number(state.outAmountRaw).toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 6 }) : "0";

        // Generic transaction entry
        void apiFetch("/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            privyUserId,
            chainType: "solana",
            assetSymbol: direction === "buy" ? (token.symbol ?? "USDC") : "USDC",
            amount: formattedOutAmountRaw,
            direction: "incoming",
            txSignature: signature,
            fromAddress: "jupiter",
            toAddress: ownerAddress ?? null,
            source: direction === "buy" ? "invest_buy" : "invest_sell",
          }),
        }).catch(() => { });

        // Structured stock purchase/sale entry
        const endpoint = direction === "buy" ? "/stock-purchases" : "/stock-sales";
        void apiFetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            privyUserId,
            stockMint: token.address,
            stockSymbol: token.symbol,
            stockName: token.name,
            usdcAmount: direction === "buy" ? input : formattedOutAmountRaw,
            sharesAmount: direction === "buy" ? formattedOutAmountRaw : input,
            walletAddress: ownerAddress ?? null,
            txSignature: signature,
            jupiterRequestId: state.requestId,
            source: direction === "buy" ? "invest_buy" : "invest_sell",
          }),
        }).catch(() => { });
      }

      // ── Optimistic holdings update ──────────────────────────────────────
      if (direction === "buy" && state.outAmountRaw) {
        const added = parseFloat(state.outAmountRaw);
        if (!Number.isNaN(added)) {
          setUserShares((prev) => {
            const current = prev ? parseFloat(prev) : 0;
            return String(Math.max(current + added, 0));
          });
        }
      } else if (direction === "sell" && input) {
        const sold = parseFloat(input);
        if (!Number.isNaN(sold)) {
          setUserShares((prev) => {
            const current = prev ? parseFloat(prev) : 0;
            return String(Math.max(current - sold, 0));
          });
        }
      }
    } catch (err: any) {
      console.error(`[InvestStockDetails] ${direction} execute error`, err);
      const msg = err?.message ?? "";
      const isCancelled = /reject|cancel|denied|refused|connect to wallet/i.test(msg);
      setState((s) => ({
        ...s,
        executeError: isCancelled ? "Cancelled transaction." : (msg || `Failed to execute ${direction} order`),
      }));
    } finally {
      setState((s) => ({ ...s, executeLoading: false }));
    }
  }, [state.unsignedTx, state.requestId, state.lastValidBlockHeight, state.outAmount, state.outAmountRaw, token, direction, wallets, signTransaction, user, input, resolveTaker, resolveOwnerAddress, setUserShares]);

  return {
    open,
    setOpen,
    input,
    setInput: handleInputChange,
    ...state,
    openDialog,
    handleExecute,
  };
}
