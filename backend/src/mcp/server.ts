import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import type { MCPContext } from "./types.js";
import { getAppBaseUrl } from "./urls.js";
import { verifyPrivyToken } from "./auth.js";
import { allTools } from "./tools/index.js";
import { registerResources } from "./resources.js";

/**
 * Creates a fresh MCP Server instance with all tool and resource handlers
 * registered.
 *
 * Accepts a token getter function so tool handlers can read the current token
 * dynamically (survives token refresh without recreating the transport).
 */
export function createMcpServer(getAuthToken: () => string | undefined, connectorUrl?: string): Server {
  const mcpServer = new Server(
    { name: "corre-defi-hub", version: "2.0.0" },
    {
      capabilities: {
        tools: {},
        resources: {},
        extensions: {
          "io.modelcontextprotocol/ui": {
            mimeTypes: ["text/html;profile=mcp-app"],
          },
        },
      },
    }
  );

  // ── Define MCP Tools ──────────────────────────────────────────────────────────
  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: allTools.map((t) => t.definition),
  }));

  // ── Tool Execution Handler ────────────────────────────────────────────────────
  // Build a lookup map from tool name → handler for O(1) dispatch (replaces the
  // 1,400-line switch statement from the monolithic file).
  const toolMap = new Map(allTools.map((t) => [t.definition.name, t.handler]));

  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      // 🔒 Verify Auth Token from request context. Read the token dynamically
      // via the getter so a post-OAuth token refresh on the SAME SSE session is
      // picked up without needing to rebind the live transport.
      const verifiedUser = await verifyPrivyToken(getAuthToken());

      const context: MCPContext = { verifiedUser, getAppBaseUrl };

      const handler = toolMap.get(name);
      if (!handler) {
        throw new Error(`Unknown tool: ${name}`);
      }

      return await handler(args || {}, context);
    } catch (err: any) {
      return {
        isError: true,
        content: [{ type: "text", text: `Error executing ${name}: ${err?.message || err}` }],
      };
    }
  });

  // ── MCP Apps: UI Resource Handlers ───────────────────────────────────────────
  registerResources(mcpServer, connectorUrl);

  return mcpServer;
}
