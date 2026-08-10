import { createHash } from "node:crypto";
import type { Request } from "express";

// Helper to resolve dynamic frontend base URL for deep links & auth URLs
export function getAppBaseUrl(): string {
  const url = process.env.FRONTEND_URL || process.env.APP_URL || process.env.VITE_APP_URL || "http://localhost:8080";
  return url.trim().replace(/\/+$/, "");
}

/**
 * Canonical MCP resource URL — must match the `resource` value published by the
 * protected-resource metadata endpoint in server.ts so ChatGPT can correlate the
 * challenge with the discovery document.
 */
export function getMcpResourceUrl(): string {
  if (process.env.NODE_ENV === "production") return "https://mcp.corre.bond";
  const base = (process.env.MCP_PUBLIC_URL || "http://localhost:4000").trim().replace(/\/+$/, "");
  return `${base}/mcp`;
}

/**
 * The canonical MCP connector URL the user pastes into Claude/ChatGPT when
 * adding the connector (e.g. https://mcp.corre.bond/mcp). Used to derive the
 * Claude widget sandbox domain, which Claude computes as
 *   sha256(connectorUrl).slice(0,32) + ".claudemcpcontent.com".
 *
 * Resolution order (most authoritative first):
 *  1. MCP_CONNECTOR_URL — an explicit, byte-exact override. STRONGLY preferred
 *     behind a proxy/tunnel (ngrok, Cloudflare) because proxies rewrite Host.
 *  2. The live request, using x-forwarded-host / x-forwarded-proto set by the
 *     proxy so we reconstruct the PUBLIC url, not the internal localhost one.
 *  3. Production/dev fallbacks.
 */
export function getMcpConnectorUrl(req?: Request): string {
  // PRIMARY: derive from the LIVE request so the computed domain matches the
  // EXACT connector URL Claude/ChatGPT connected with — including the path and
  // trailing slash. Claude hashes the connector URL verbatim, so if the user
  // added the bare origin (Claude stores & connects to ".../") we must hash
  // ".../", and if they added ".../mcp" we must hash ".../mcp". Deriving from
  // the inbound request makes this self-correcting either way.
  if (req) {
    // x-forwarded-host is set by ngrok/Cloudflare to the ORIGINAL public host.
    // Fall back to Host only if the proxy didn't provide it.
    const fwdHost = (req.headers["x-forwarded-host"] as string | undefined)?.split(",")[0]?.trim();
    const host = fwdHost || req.headers.host;
    if (host) {
      const fwdProto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim();
      const proto = fwdProto || (host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https");
      // Preserve the exact inbound path verbatim (do NOT strip the trailing
      // slash, do NOT force "/mcp"). For a root connection this is "/", for the
      // dedicated endpoint it is "/mcp" — matching Claude's stored connector URL.
      const path = (req.originalUrl || req.url || req.path || "/").split("?")[0];
      return `${proto}://${host}${path}`;
    }
  }
  // FALLBACK (no live request, e.g. metadata built at startup): explicit env
  // override, then production/dev defaults.
  if (process.env.MCP_CONNECTOR_URL) {
    return process.env.MCP_CONNECTOR_URL.trim();
  }
  if (process.env.NODE_ENV === "production") return "https://mcp.corre.bond/mcp";
  return `${(process.env.MCP_PUBLIC_URL || "http://localhost:4000").trim().replace(/\/+$/, "")}/mcp`;
}

/**
 * Computes the widget sandbox domain Claude expects for MCP Apps. Per the MCP
 * Apps spec, Claude sandboxes the iframe at:
 *   sha256(connectorUrl).slice(0, 32) + ".claudemcpcontent.com"
 * The `_meta.ui.domain` we advertise MUST equal this exactly or Claude rejects
 * the widget with "ui.domain validation failed".
 */
export function computeClaudeAppDomain(connectorUrl: string): string {
  const hash = createHash("sha256").update(connectorUrl).digest("hex").slice(0, 32);
  return `${hash}.claudemcpcontent.com`;
}
