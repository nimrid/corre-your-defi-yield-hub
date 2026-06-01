import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";

import { PrivyProvider } from "@privy-io/react-auth";
import React from "react";
import { base, lisk } from "viem/chains";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";
import { Buffer } from "buffer";

if (typeof window !== "undefined" && !(window as any).Buffer) {
  (window as any).Buffer = Buffer;
}

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID;
const SOLANA_HTTP_RPC =
  import.meta.env.VITE_SOLANA_RPC ||
  "https://solana-mainnet.g.alchemy.com/v2/C5-LCLXSwlCEtsquSDPIj";
// const SOLANA_WS_RPC = SOLANA_HTTP_RPC.replace("https://", "wss://");
const SOLANA_WS_RPC = import.meta.env.VITE_SOLANA_WS_RPC || 
  "wss://mainnet.helius-rpc.com/?api-key=41c75a65-eb0d-4509-9851-7ba59261081a";

if (!PRIVY_APP_ID) {
  throw new Error("VITE_PRIVY_APP_ID is not set. Please define it in frontend/.env");
}

createRoot(document.getElementById("root")!).render(
  (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        appearance: {walletChainType: 'ethereum-and-solana'},
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
          solana: { createOnLogin: "users-without-wallets" },
        },
        solana: {
          rpcs: {
            "solana:mainnet": {
              rpc: createSolanaRpc(SOLANA_HTTP_RPC),
              rpcSubscriptions: createSolanaRpcSubscriptions(SOLANA_WS_RPC),
            },
          },
        },
        defaultChain: base,
        supportedChains: [base, lisk],
      }}
    >
      <App />
    </PrivyProvider>
  ) as React.ReactNode
);
