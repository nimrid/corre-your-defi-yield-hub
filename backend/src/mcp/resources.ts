import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { getAppBaseUrl, getMcpConnectorUrl, computeClaudeAppDomain } from "./urls.js";
import { getTransactionUIHTML } from "./ui/transactionUI.js";
import { getAuthUIHTML } from "./ui/authUI.js";

/**
 * Helper to resolve CSP domains dynamically for dev (ngrok / localhost) and
 * production. Used as `_meta` on every resource response.
 */
function getCspMeta(connectorUrl?: string) {
  const baseUrl = getAppBaseUrl();
  let appHost = "corre.bond";
  try {
    appHost = new URL(baseUrl).hostname;
  } catch (e) {}

  // Derive both Claude and ChatGPT widget domains from the actual MCP connector URL.
  // ChatGPT reads openai/widgetDomain, Claude reads ui.domain (computed differently).
  const resolvedConnectorUrl = connectorUrl || getMcpConnectorUrl();
  let mcpHost = "corre.bond";
  try {
    mcpHost = new URL(resolvedConnectorUrl).hostname;
  } catch (e) {}

  // Dev-only origins (ngrok tunnels, localhost) are excluded from the widget
  // sandbox CSP in production so the sandbox can't be weakened by a stray tunnel.
  const devDomains = process.env.NODE_ENV === "production"
    ? []
    : [
        "incongrously-beetlike-anabel.ngrok-free.dev",
        "*.ngrok-free.dev",
        "*.ngrok.app",
        "*.ngrok.io",
        "localhost",
        "127.0.0.1",
      ];

  const connectDomains = Array.from(new Set([
    "corre.bond",
    appHost,
    mcpHost,
    ...devDomains,
  ]));

  const resourceDomains = Array.from(new Set([
    "corre.bond",
    appHost,
    mcpHost,
    "fonts.googleapis.com",
    "fonts.gstatic.com",
    "api.qrserver.com",
    ...devDomains,
  ]));

  // Per the MCP Apps spec, Claude sandboxes widgets at sha256(connectorUrl)
  // .slice(0,32) + ".claudemcpcontent.com" and rejects any mismatch.
  const claudeAppDomain = computeClaudeAppDomain(resolvedConnectorUrl);

  // ChatGPT uses the connector host directly for openai/widgetDomain
  const domainVal = mcpHost || "corre.bond";
  const cspStandard = {
    connectDomains,
    resourceDomains,
    frameDomains: ["*"],
  };
  const cspOpenAI = {
    connect_domains: connectDomains,
    resource_domains: resourceDomains,
    redirect_domains: connectDomains,
  };

  return {
    domain: domainVal,
    csp: cspStandard,
    widgetDomain: domainVal,
    widgetCSP: cspOpenAI,
    "openai/widgetDomain": domainVal,
    "openai/widgetCSP": cspOpenAI,
    ui: {
      // Claude reads ui.domain; ChatGPT reads openai/widgetDomain above.
      domain: claudeAppDomain,
      csp: cspStandard,
    },
  };
}

/**
 * Registers all MCP resource handlers (ListResources, ListResourceTemplates,
 * ReadResource) on the given server instance.
 */
export function registerResources(mcpServer: Server, connectorUrl?: string): void {
  // ── MCP Apps: UI Resource Handlers ───────────────────────────────────────────
  // Serves the transaction approval iframe HTML for the ui://corre/transaction resource.
  // This iframe is rendered inside Claude/ChatGPT when any prepare_* tool is called.

  mcpServer.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      {
        uri: "ui://corre/transaction",
        name: "Transaction Approval",
        description: "Interactive transaction approval card for Corre DeFi operations",
        mimeType: "text/html;profile=mcp-app",
        _meta: getCspMeta(connectorUrl),
      },
      {
        uri: "ui://corre/auth",
        name: "Authentication Required",
        description: "Interactive authentication modal for user login and instant onboarding",
        mimeType: "text/html;profile=mcp-app",
        _meta: getCspMeta(connectorUrl),
      },
    ],
  }));

  mcpServer.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
    resourceTemplates: [
      {
        uriTemplate: "ui://corre/transaction",
        name: "Transaction Approval",
        description: "Interactive transaction approval card for Corre DeFi operations",
        mimeType: "text/html;profile=mcp-app",
        _meta: getCspMeta(connectorUrl),
      },
      {
        uriTemplate: "ui://corre/auth",
        name: "Authentication Required",
        description: "Interactive authentication modal for user login and instant onboarding",
        mimeType: "text/html;profile=mcp-app",
        _meta: getCspMeta(connectorUrl),
      },
    ],
  }));

  mcpServer.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    if (uri === "ui://corre/transaction") {
      return {
        contents: [
          {
            uri,
            mimeType: "text/html;profile=mcp-app",
            text: getTransactionUIHTML(getAppBaseUrl()),
            // MUST advertise ui.domain here — Claude reads it from the resource
            // contents to validate the widget sandbox origin. Without it, Claude
            // falls back to hashing its own connector URL and rejects the widget.
            _meta: getCspMeta(connectorUrl),
          },
        ],
        _meta: getCspMeta(connectorUrl),
      };
    }

    if (uri === "ui://corre/auth") {
      return {
        contents: [
          {
            uri,
            mimeType: "text/html;profile=mcp-app",
            text: getAuthUIHTML(getAppBaseUrl()),
            _meta: getCspMeta(connectorUrl),
          },
        ],
        _meta: getCspMeta(connectorUrl),
      };
    }

    throw new Error(`Unknown resource: ${uri}`);
  });
}
