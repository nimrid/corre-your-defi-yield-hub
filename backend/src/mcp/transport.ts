import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Request, Response } from "express";

import { createMcpServer } from "./server.js";
import { getMcpConnectorUrl, getMcpResourceUrl } from "./urls.js";

// ── Legacy SSE Transport (GET /mcp → stream, POST /mcp/messages → RPC) ───────
interface SessionEntry {
  server: Server;
  transport: SSEServerTransport;
  // Mutable holder so a token refresh is visible to the already-connected
  // server's tool handler (which reads it via a getter closure).
  authToken?: string;
}

const sessions = new Map<string, SessionEntry>();

// ── Unified MCP Transport Handler (SSE + Streamable HTTP) ────────────────────
// Handles both the legacy SSE transport (GET → stream, POST /mcp/messages)
// and the modern Streamable HTTP transport (POST → single endpoint JSON-RPC).
// Claude Desktop/web/Code use Streamable HTTP; older clients use SSE.
export async function handleMcpRequest(req: Request, res: Response) {
  const method = req.method;

  // GET → legacy SSE transport (opens an event stream)
  if (method === "GET") {
    return handleMcpSse(req, res);
  }

  // POST → Streamable HTTP transport (stateless JSON-RPC)
  if (method === "POST") {
    try {
      const authToken = (req.headers.authorization || req.headers["x-privy-token"] || req.headers["x-user-token"]) as string | undefined;
      const connectorUrl = getMcpConnectorUrl(req);

      // ⚠️ COMPATIBILITY SHIM: the MCP SDK's Streamable HTTP transport strictly
      // rejects (406) any POST whose Accept header does not list BOTH
      // "application/json" AND "text/event-stream". Real hosts violate this:
      //   • ChatGPT's template/resource fetch sends only "application/json"
      //     → 406 → "Error loading app: Failed to fetch template".
      //   • Some proxies drop/rewrite Accept entirely.
      // We normalize the Accept header to satisfy the SDK. @hono/node-server
      // builds the Web Request from req.rawHeaders (not req.headers), so we must
      // patch the rawHeaders flat array directly. enableJsonResponse (below) means
      // non-streaming clients get a plain JSON body they can parse.
      const accept = String(req.headers["accept"] || "");
      if (!accept.includes("application/json") || !accept.includes("text/event-stream")) {
        // Mutate req.rawHeaders in place — it's a flat ['key1', 'val1', 'key2', ...] array.
        // Find the accept/Accept index and replace its value.
        const raw = req.rawHeaders;
        const acceptIdx = raw.findIndex((k, i) => i % 2 === 0 && k.toLowerCase() === "accept");
        if (acceptIdx >= 0) {
          raw[acceptIdx + 1] = "application/json, text/event-stream";
        } else {
          // No Accept header at all — append it.
          raw.push("Accept", "application/json, text/event-stream");
        }
      }

      // Stateless: create a fresh server + transport per POST, no session state.
      // sessionIdGenerator: undefined  → stateless mode (no Mcp-Session-Id).
      // enableJsonResponse: true       → return a single JSON response for
      //   request/response exchanges instead of forcing an SSE stream, which is
      //   what ChatGPT and simple JSON clients expect.
      const session = { authToken };
      const server = createMcpServer(() => session.authToken, connectorUrl);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });

      await server.connect(transport);

      // Clean up after the request completes
      res.on("close", async () => {
        try {
          await transport.close();
          await server.close();
        } catch (err) {
          console.error("[MCP] Cleanup error:", err);
        }
      });

      // Handle the JSON-RPC request (pass req, res, body)
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error("[MCP] Streamable HTTP error:", err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
    return;
  }

  // Unsupported method
  res.status(405).json({ error: `Method ${method} not allowed` });
}

async function handleMcpSse(req: Request, res: Response) {
  try {
    const authToken = (req.headers.authorization || req.headers["x-privy-token"] || req.headers["x-user-token"]) as string | undefined;
    // Derive the connector URL from the request (x-forwarded-* aware) so the
    // Claude widget domain hash matches the public URL the user connected with.
    const connectorUrl = getMcpConnectorUrl(req);
    const session: SessionEntry = { server: null as unknown as Server, transport: null as unknown as SSEServerTransport, authToken };
    // Pass a getter that always reads the LATEST token from the session entry,
    // so post-OAuth refreshes are honored without rebinding the transport.
    const server = createMcpServer(() => session.authToken, connectorUrl);
    const transport = new SSEServerTransport("/mcp/messages", res);
    session.server = server;
    session.transport = transport;

    await server.connect(transport);
    sessions.set(transport.sessionId, session);

    req.on("close", () => {
      sessions.delete(transport.sessionId);
    });
  } catch (err) {
    console.error("[MCP] SSE connection error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to establish MCP connection" });
    }
  }
}

export async function handleMcpMessages(req: Request, res: Response) {
  const sessionId = req.query.sessionId as string;

  if (!sessionId) {
    res.status(400).json({ error: "Missing required sessionId parameter" });
    return;
  }

  const session = sessions.get(sessionId);

  if (!session) {
    res.status(400).json({ error: "No active SSE session found for the provided sessionId" });
    return;
  }

  // 🔄 TOKEN UPDATE: After OAuth reconnect, the host sends the new access_token
  // in the Authorization header of subsequent tool calls. The existing SSE
  // session (keyed by sessionId) still holds the old token, so update it in
  // place. The already-connected server reads this value via its getter closure,
  // so no transport rebind is needed (rebinding would break the live stream).
  const incomingToken = (req.headers.authorization || req.headers["x-privy-token"] || req.headers["x-user-token"]) as string | undefined;
  if (incomingToken && incomingToken !== session.authToken) {
    console.log(`[MCP] Updating token for session ${sessionId.substring(0, 8)}...`);
    session.authToken = incomingToken;
  }

  // 🔒 Transport-level auth check for Claude (and any MCP client following the
  // standard spec). Only apply to protected tool calls — public tools (quotes,
  // rates) and meta operations (initialize, list) stay anonymous. When no valid
  // token is present for a protected tool, return HTTP 401 with the
  // WWW-Authenticate header. This triggers Claude Desktop/claude.ai's native
  // re-auth flow (walking the OAuth discovery chain).
  const body = req.body;
  const isToolCall = body?.method === "tools/call";
  const toolName = isToolCall ? body?.params?.name : null;
  const protectedTools = [
    "get_user_portfolio",
    "get_user_wallet",
    "prepare_buy_usdc_naira",
    "prepare_offramp_usdc",
    "prepare_transfer_usdc",
    "prepare_buy_stock",
    "prepare_sell_stock",
    "prepare_savings_deposit",
    "prepare_savings_withdraw",
    "execute_transaction",
    "get_user_referral_info",
    "create_stock_limit_order",
    "create_stock_dca_schedule",
    "get_pending_withdrawals",
  ];

  if (isToolCall && toolName && protectedTools.includes(toolName) && !session.authToken) {
    const resourceMetadataUrl = `${getMcpResourceUrl().replace(/\/mcp$/, "")}/.well-known/oauth-protected-resource/mcp`;
    res.setHeader(
      "WWW-Authenticate",
      `Bearer error="invalid_token", ` +
      `error_description="Authentication required. Please sign in to your Corre account.", ` +
      `resource_metadata="${resourceMetadataUrl}", ` +
      `scope="openid profile email"`
    );
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  await session.transport.handlePostMessage(req, res, req.body);
}
