import "./polyfills";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";

// Auto-recover from stale dynamic chunk imports when a new build is deployed mid-session
window.addEventListener("vite:preloadError", (event) => {
  console.warn("New version detected or chunk load failed. Reloading to update...", event);
  window.location.reload();
});

// Clean up any lingering service workers and Workbox caches from previous PWA builds
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      const scriptURL =
        registration.active?.scriptURL ||
        registration.installing?.scriptURL ||
        registration.waiting?.scriptURL ||
        "";
      if (
        scriptURL.includes("sw.js") ||
        scriptURL.includes("workbox") ||
        (scriptURL && !scriptURL.includes("OneSignalSDKWorker"))
      ) {
        registration.unregister().catch(() => {});
      }
    }
  }).catch(() => {});

  if ("caches" in window) {
    caches.keys().then((names) => {
      for (const name of names) {
        if (
          name.includes("workbox") ||
          name.includes("html-cache") ||
          name.includes("static-resources") ||
          name.includes("image-cache")
        ) {
          caches.delete(name).catch(() => {});
        }
      }
    }).catch(() => {});
  }
}

import { PrivyProvider } from "@privy-io/react-auth";
import React from "react";
import { base, lisk } from "viem/chains";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";


const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID;
const SOLANA_HTTP_RPC =
  import.meta.env.VITE_SOLANA_RPC ||
  "https://solana-mainnet.g.alchemy.com/v2/C5-LCLXSwlCEtsquSDPIj";
// const SOLANA_WS_RPC = SOLANA_HTTP_RPC.replace("https://", "wss://");
const SOLANA_WS_RPC =
  import.meta.env.VITE_SOLANA_WS_RPC ||
  "wss://mainnet.helius-rpc.com/?api-key=41c75a65-eb0d-4509-9851-7ba59261081a";
const SOLANA_DEVNET_HTTP_RPC =
  import.meta.env.VITE_GETEQUITY_SOLANA_RPC ||
  "https://api.devnet.solana.com";
const SOLANA_DEVNET_WS_RPC =
  import.meta.env.VITE_GETEQUITY_SOLANA_WS_RPC ||
  "wss://api.devnet.solana.com";

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
              rpc: createSolanaRpc(SOLANA_HTTP_RPC) as any,
              rpcSubscriptions: createSolanaRpcSubscriptions(SOLANA_WS_RPC) as any,
            },
            "solana:devnet": {
              rpc: createSolanaRpc(SOLANA_DEVNET_HTTP_RPC) as any,
              rpcSubscriptions: createSolanaRpcSubscriptions(SOLANA_DEVNET_WS_RPC) as any,
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
