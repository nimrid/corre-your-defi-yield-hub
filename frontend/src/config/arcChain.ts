import { defineChain, createPublicClient, http } from "viem";

export const ARC_CHAIN_ID = 5042;
export const ARC_TESTNET_CHAIN_ID = 5042002;

/**
 * PAJ Ramp & Arc Ecosystem registered USDC contract address / mint identifier.
 */
export const ARC_USDC_MINT = "0x3600000000000000000000000000000000000000";

/**
 * Resolve the active Arc RPC endpoint, preferring VITE_ARC_RPC (e.g. Alchemy) with public fallback.
 */
export const getArcRpcUrl = (): string => {
  const envRpc = import.meta.env.VITE_ARC_RPC;
  if (typeof envRpc === "string" && envRpc.trim()) {
    return envRpc.replace(/^['"]|['"]$/g, "").trim();
  }
  return "https://rpc.mainnet.arc.io";
};

/**
 * Arc Mainnet
 * Enterprise-grade stablecoin-native Layer-1 blockchain built by Circle.
 * Uses USDC natively as its gas token.
 */
export const arc = defineChain({
  id: ARC_CHAIN_ID,
  name: "Arc",
  network: "arc",
  nativeCurrency: {
    name: "USD Coin",
    symbol: "USDC",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [getArcRpcUrl()],
    },
    public: {
      http: [getArcRpcUrl(), "https://rpc.mainnet.arc.io"],
    },
  },
  blockExplorers: {
    default: {
      name: "ArcScan",
      url: "https://explorer.arc.io",
    },
  },
});

/**
 * Create a dedicated Viem public client configured with the active Arc RPC URL.
 */
export const getArcPublicClient = () => {
  return createPublicClient({
    chain: arc,
    transport: http(getArcRpcUrl()),
  });
};

/**
 * Arc Testnet
 */
export const arcTestnet = defineChain({
  id: ARC_TESTNET_CHAIN_ID,
  name: "Arc Testnet",
  network: "arc-testnet",
  nativeCurrency: {
    name: "USD Coin",
    symbol: "USDC",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [import.meta.env.VITE_ARC_TESTNET_RPC || "https://rpc.testnet.arc.io"],
    },
    public: {
      http: ["https://rpc.testnet.arc.io"],
    },
  },
  blockExplorers: {
    default: {
      name: "ArcScan Testnet",
      url: "https://testnet.explorer.arc.io",
    },
  },
  testnet: true,
});
