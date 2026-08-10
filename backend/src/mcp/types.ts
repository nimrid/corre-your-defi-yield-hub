export interface VerifiedUser {
  privyUserId: string;
  email?: string;
}

export interface MCPContext {
  verifiedUser: VerifiedUser | null;
  getAppBaseUrl: () => string;
}

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  _meta?: Record<string, any>;
}

export interface MCPTool {
  definition: MCPToolDefinition;
  handler: (args: Record<string, any>, context: MCPContext) => Promise<any>;
}
