import { useEffect, useState, useMemo, useRef } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  useWallets as useSolanaWallets,
  useSignTransaction,
  useSignAndSendTransaction,
} from "@privy-io/react-auth/solana";
import type { WebMcpConnectionStatus, WebMcpContext } from "./types";
import { emitWebMcpToast } from "./toastEmitter";
import { getAllWebMcpTools } from "./tools";
import { registerToolsWithBrowser } from "./engine";

export function useWebMcp() {
  const { authenticated, user, getAccessToken } = usePrivy();
  const { wallets: solanaWallets } = useSolanaWallets();
  const { signTransaction } = useSignTransaction();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const [status, setStatus] = useState<WebMcpConnectionStatus>("checking");

  // Resolve primary Solana wallet address
  const linkedSolana = (user?.linkedAccounts ?? []).filter(
    (a: any) =>
      a.chainType === "solana" ||
      a.chain_type === "solana" ||
      (a.type === "wallet" && a.address && !a.address.startsWith("0x"))
  );
  const primarySolanaWallet = solanaWallets[0] || null;
  const primarySolanaAddress: string | null =
    (primarySolanaWallet as any)?.address ?? (linkedSolana[0] as any)?.address ?? null;

  // Use ref to hold current context without breaking memoization
  const contextRef = useRef<WebMcpContext>(null!);
  contextRef.current = {
    authenticated,
    privyUser: user,
    solanaWalletAddress: primarySolanaAddress,
    solanaWallet: primarySolanaWallet,
    solanaWallets,
    signTransaction,
    signAndSendTransaction,
    getAccessToken: async () => {
      try {
        return await getAccessToken();
      } catch {
        return null;
      }
    },
    emitToast: emitWebMcpToast,
  };

  // Stable proxy context that dynamically dispatches to the latest contextRef.current on execution
  const stableContext = useMemo(() => {
    return new Proxy({} as WebMcpContext, {
      get: (_target, prop: string | symbol) => {
        return (contextRef.current as any)?.[prop];
      },
    });
  }, []);

  // Stable tool definitions generated once
  const tools = useMemo(() => getAllWebMcpTools(stableContext), [stableContext]);

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    registerToolsWithBrowser(tools, controller.signal).then((connStatus) => {
      if (isMounted) {
        setStatus(connStatus);
      }
    });

    return () => {
      isMounted = false;
      controller.abort();
      if (typeof window !== "undefined") {
        delete window.__correWebMCP;
      }
    };
  }, [tools]);

  return {
    status,
    toolsCount: tools.length,
    tools,
  };
}
