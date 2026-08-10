import { PrivyClient } from "@privy-io/server-auth";
import { getMcpResourceUrl } from "./urls.js";
import { VerifiedUser } from "./types.js";

// Initialize Privy Server Client for in-chat wallet creation & user management
const privyAppId = process.env.PRIVY_APP_ID || "";
const privyAppSecret = process.env.PRIVY_APP_SECRET || "";

export const privy = privyAppId && privyAppSecret ? new PrivyClient(privyAppId, privyAppSecret) : null;

/**
 * Builds the standard "authentication required" MCP tool result that triggers
 * ChatGPT/Claude's NATIVE reconnect/link dialog.
 *
 * Per the MCP authorization spec + OpenAI Apps SDK, the host only shows its
 * built-in re-auth UI when the tool result is an error that carries
 * `_meta["mcp/www_authenticate"]` pointing at the protected-resource metadata.
 * A custom UI widget can never trigger that dialog — this is the documented hook.
 */
export function authRequiredResult(message: string) {
  // Publish the resource-metadata URL with the /mcp suffix, matching the
  // Apps SDK example and one of the variants server.ts serves. ChatGPT fetches
  // this to walk the OAuth discovery chain and launch its native re-auth UI.
  const resourceMetadataUrl = `${getMcpResourceUrl().replace(/\/mcp$/, "")}/.well-known/oauth-protected-resource/mcp`;
  const wwwAuthenticate =
    `Bearer error="invalid_token", ` +
    `error_description="${message.replace(/"/g, "'")}", ` +
    `resource_metadata="${resourceMetadataUrl}", ` +
    `scope="openid profile email"`;
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ status: "authentication_required", message }),
      },
    ],
    _meta: {
      "mcp/www_authenticate": wwwAuthenticate,
    },
  };
}

/**
 * Verifies Privy Auth Token from Authorization header or custom header.
 * Returns verified user context (privyUserId & email) or null if unauthenticated.
 */
export async function verifyPrivyToken(authToken?: string): Promise<VerifiedUser | null> {
  if (!authToken) return null;
  const token = authToken.replace(/^Bearer\s+/i, "").trim();

  // 1. Dev API Key check — ONLY honored outside production so it can never be
  // used as an impersonation backdoor to a real account in prod.
  const devKey = process.env.MCP_DEV_API_KEY;
  if (process.env.NODE_ENV !== "production" && devKey && token === devKey) {
    return { privyUserId: "did:privy:cm9pknqvm01h7ji0llz4ovyty", email: "1captaineddy@gmail.com" };
  }

  // 2. Privy Session Token check
  if (privy) {
    try {
      const claims = await privy.verifyAuthToken(token);
      if (claims && claims.userId) {
        const user = await privy.getUser(claims.userId).catch(() => null);
        const email = user?.email?.address || (user?.linkedAccounts.find((a: any) => a.type === "email") as any)?.address;
        return { privyUserId: claims.userId, email };
      }
    } catch (err) {
      console.warn("[MCP Security] Token verification failed:", err);
    }
  }
  return null;
}
