export interface WebMcpToolAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  openWorldHint?: boolean;
}

export interface WebMcpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  annotations?: WebMcpToolAnnotations;
}

export interface WebMcpTool extends WebMcpToolDefinition {
  execute: (params: any) => Promise<any>;
}

export interface WebMcpToast {
  id: string;
  icon: string;
  title: string;
  detail: string;
  timestamp: number;
  type?: "info" | "success" | "warning" | "error";
}

export type WebMcpConnectionStatus = "checking" | "connected" | "fallback";

export interface WebMcpContext {
  authenticated: boolean;
  privyUser: any | null;
  solanaWalletAddress: string | null;
  solanaWallet: any | null;
  solanaWallets: any[];
  signTransaction?: (args: { transaction: Uint8Array; wallet?: any }) => Promise<any>;
  signAndSendTransaction?: (args: { transaction: Uint8Array; wallet?: any }) => Promise<any>;
  getAccessToken: () => Promise<string | null>;
  emitToast: (icon: string, title: string, detail: string, type?: WebMcpToast["type"]) => void;
}
