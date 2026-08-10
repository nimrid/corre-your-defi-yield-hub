import express from "express";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { randomUUID } from "node:crypto";

// Route modules
import userRoutes from "./routes/userRoutes.js";
import transactionRoutes from "./routes/transactionRoutes.js";
import savingsRoutes from "./routes/savingsRoutes.js";
import stockRoutes from "./routes/stockRoutes.js";
import withdrawalRoutes from "./routes/withdrawalRoutes.js";
import gasSponsorshipRoutes from "./routes/gasSponsorshipRoutes.js";
import pajSessionRoutes from "./routes/pajSessionRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import africaRoutes from "./routes/africaRoutes.js";
import heliusWebhookRoutes from "./routes/heliusWebhook.js";
import privyWebhookRoutes from "./routes/privyWebhook.js";
import pajWebhookRoutes from "./routes/pajWebhook.js";
import adminRoutes from "./routes/adminRoutes.js";
import investRoutes from "./routes/investRoutes.js";

// ── Schema bootstrap
import { runMigrations } from "./migrations.js";

// Inngest
import { serve } from "inngest/express";
import { inngest } from "./inngest/client.js";
import { sendWeeklyYieldEmails } from "./inngest/functions.js";

// ── Environment ──────────────────────────────────────────────────────────────
dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

// ── CORS ─────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  // Local development
  "http://localhost:3000",
  "http://localhost:4000",
  "http://localhost:5173",
  "http://localhost:8080",
  // ngrok tunnel
  "https://incongrously-beetlike-anabel.ngrok-free.dev",
  // AI Platforms (ChatGPT & Claude)
  "https://chatgpt.com",
  "https://chat.openai.com",
  "https://platform.openai.com",
  "https://claude.ai",
  // Production
  "https://defi-corre.onrender.com",
  "https://corre.bond",
  "https://www.corre.bond",
  "https://api.corre.bond",
  "https://mcp.corre.bond",
  "https://admincorre.netlify.app",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin) || origin.endsWith(".openai.com") || origin.endsWith(".chatgpt.com")) {
        callback(null, true);
      } else {
        console.warn(`[CORS] Blocked request from origin: ${origin}`);
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-privy-token",
      "x-user-token",
      // Admin dashboard authentication
      "x-admin-key",
      // Svix webhook verification headers
      "svix-id",
      "svix-timestamp",
      "svix-signature",
      // ngrok browser warning bypass
      "ngrok-skip-browser-warning",
    ],
    // Expose the auth challenge header so MCP clients (ChatGPT/Claude) can read
    // it and trigger their native re-auth flow.
    exposedHeaders: ["WWW-Authenticate", "Mcp-Session-Id"],
  })
);

// Handle all pre-flight requests
app.options("*", cors());

// ── Compression (must be first — compresses all subsequent responses) ─────────
// Automatically gzip/deflates responses >1KB, saving 60-80% bandwidth on JSON.
app.use(compression());

// ── Security Headers ─────────────────────────────────────────────────────────
app.use(helmet({
  // Allow SSE connections and inline scripts for MCP
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// ── Rate Limiting ────────────────────────────────────────────────────────────
// General API rate limit: 200 requests per 15 minutes per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});
app.use("/api", apiLimiter);

// Stricter limit on MCP endpoints: 60 requests per minute per IP
const mcpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "MCP rate limit exceeded. Please slow down." },
});
app.use("/mcp", mcpLimiter);

// Strict limit on OAuth token endpoint: 10 requests per minute per IP
const oauthLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many token requests. Please try again later." },
});
app.use("/oauth", oauthLimiter);

// ── Webhook routes (must be mounted BEFORE express.json()) ───────────────────
// The Privy webhook uses express.raw() internally to capture the raw body for
// Svix signature verification — express.json() must NOT have run first.
app.use("/api/webhooks", privyWebhookRoutes);

// ── Global body parsers ──────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// ── MCP Protocol Routes (Claude / ChatGPT Remote MCP) ────────────────────────
import { handleMcpRequest, handleMcpMessages } from "./mcp/index.js";
// Both `/` and `/mcp` serve SSE (GET) + Streamable HTTP (POST). `/mcp` is
// covered by app.use("/mcp", mcpLimiter) above; the root alias needs the limiter
// attached directly (app.all("/") matches only the exact path, so this does not
// throttle the other mounted routes).
app.all("/mcp", handleMcpRequest);
app.all("/", mcpLimiter, handleMcpRequest);
// Legacy SSE message endpoint (POST /mcp/messages?sessionId=...)
app.post("/mcp/messages", handleMcpMessages);

// ── OAuth 2.0 Discovery & Protected Resource Metadata (RFC 8414 & RFC 9728) ─
const getAuthServerMetadata = (req: express.Request) => {
  const host = req.headers.host || "localhost:4000";
  const protocol = req.headers["x-forwarded-proto"] || (host.includes("localhost") ? "http" : "https");
  let backendUrl = `${protocol}://${host}`;
  if (process.env.NODE_ENV === "production") {
    backendUrl = "https://mcp.corre.bond";
  }
  const frontendUrl = (process.env.FRONTEND_URL || process.env.APP_URL || (process.env.NODE_ENV === "production" ? "https://corre.bond" : `http://${host}`)).replace(/\/+$/, "");

  return {
    issuer: backendUrl,
    authorization_endpoint: `${frontendUrl}/login`,
    token_endpoint: `${backendUrl}/oauth/token`,
    registration_endpoint: `${backendUrl}/oauth/register`,
    scopes_supported: ["openid", "profile", "email"],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256", "plain"],
    token_endpoint_auth_methods_supported: ["none"],
  };
};

const getOpenIdMetadata = (req: express.Request) => {
  const host = req.headers.host || "localhost:4000";
  const protocol = req.headers["x-forwarded-proto"] || (host.includes("localhost") ? "http" : "https");
  let backendUrl = `${protocol}://${host}`;
  if (process.env.NODE_ENV === "production") {
    backendUrl = "https://mcp.corre.bond";
  }
  const frontendUrl = (process.env.FRONTEND_URL || process.env.APP_URL || (process.env.NODE_ENV === "production" ? "https://corre.bond" : `http://${host}`)).replace(/\/+$/, "");

  return {
    issuer: backendUrl,
    authorization_endpoint: `${frontendUrl}/login`,
    token_endpoint: `${backendUrl}/oauth/token`,
    registration_endpoint: `${backendUrl}/oauth/register`,
    jwks_uri: "https://auth.privy.io/api/v1/apps/cm9jlcquu02arle0mt3abqs5e/jwks.json",
    response_types_supported: ["code"],
    subject_types_supported: ["public"],
    code_challenge_methods_supported: ["S256", "plain"],
    token_endpoint_auth_methods_supported: ["none"],
  };
};

const getProtectedResourceMetadata = (req: express.Request) => {
  const host = req.headers.host || "localhost:4000";
  const protocol = req.headers["x-forwarded-proto"] || (host.includes("localhost") ? "http" : "https");
  
  let mcpResourceUrl = `${protocol}://${host}/mcp`;
  let authServerUrl = `${protocol}://${host}`;
  if (process.env.NODE_ENV === "production") {
    mcpResourceUrl = "https://mcp.corre.bond";
    authServerUrl = "https://mcp.corre.bond";
  }

  return {
    resource: mcpResourceUrl,
    authorization_servers: [authServerUrl],
    scopes_supported: ["openid", "profile", "email"],
    bearer_methods_supported: ["header"],
  };
};

const authServerPaths = [
  "/.well-known/oauth-authorization-server",
  "/.well-known/oauth-authorization-server/mcp",
  "/mcp/.well-known/oauth-authorization-server",
];

const openIdPaths = [
  "/.well-known/openid-configuration",
  "/.well-known/openid-configuration/mcp",
  "/mcp/.well-known/openid-configuration",
];

const protectedResourcePaths = [
  "/.well-known/oauth-protected-resource",
  "/.well-known/oauth-protected-resource/mcp",
  "/mcp/.well-known/oauth-protected-resource",
];

app.get(authServerPaths, (req, res) => res.json(getAuthServerMetadata(req)));
app.get(openIdPaths, (req, res) => res.json(getOpenIdMetadata(req)));
app.get(protectedResourcePaths, (req, res) => res.json(getProtectedResourceMetadata(req)));

// ── OAuth 2.0 Dynamic Client Registration (RFC 7591) ──────────────────────────
// Claude (Desktop/web/Code) and ChatGPT/Codex are "DCR-only": on connect they
// POST here to self-register and obtain a client_id. If this endpoint is missing
// they hard-fail with "Automatic client registration isn't supported by … Edit
// the connector and add an OAuth Client ID." There is no fallback in those
// clients, so we must accept the registration.
//
// This is a stateless stub: we mint a client_id (and echo back the requested
// metadata) without persisting it. Security does NOT rely on client_id here —
// it relies on PKCE (S256) + the Privy token verification performed at
// /oauth/token. Registration is deliberately open per the MCP OAuth model.
const registrationPaths = [
  "/oauth/register",
  "/oauth/register/mcp",
  "/mcp/oauth/register",
];

app.post(registrationPaths, (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;

  // RFC 7591: redirect_uris is REQUIRED for authorization_code clients. Echo the
  // client's requested values back so the host binds to exactly what it sent
  // (Claude/Codex use ephemeral http://localhost:<port>/callback URIs).
  const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris : [];

  const clientId = `mcp_${randomUUID().replace(/-/g, "")}`;
  const nowSeconds = Math.floor(Date.now() / 1000);

  res.status(201).json({
    client_id: clientId,
    // Public client (PKCE), no secret issued → omit client_secret entirely.
    client_id_issued_at: nowSeconds,
    redirect_uris: redirectUris,
    grant_types: Array.isArray(body.grant_types) ? body.grant_types : ["authorization_code"],
    response_types: Array.isArray(body.response_types) ? body.response_types : ["code"],
    token_endpoint_auth_method: "none",
    client_name: typeof body.client_name === "string" ? body.client_name : "MCP Client",
    scope: typeof body.scope === "string" ? body.scope : "openid profile email",
  });
});

// ── OAuth 2.0 Token Exchange Endpoint ─────────────────────────────────────────
import { PrivyClient } from "@privy-io/server-auth";

const privyTokenClient = (process.env.PRIVY_APP_ID && process.env.PRIVY_APP_SECRET)
  ? new PrivyClient(process.env.PRIVY_APP_ID, process.env.PRIVY_APP_SECRET)
  : null;

app.post("/oauth/token", async (req, res) => {
  const code = req.body?.code || req.body?.access_token;

  if (!code || typeof code !== "string" || code.length < 10) {
    res.status(400).json({ error: "Missing or invalid authorization code" });
    return;
  }

  // Validate the token against Privy before issuing an access token.
  if (privyTokenClient) {
    try {
      const claims = await privyTokenClient.verifyAuthToken(code);
      if (!claims?.userId) {
        res.status(401).json({ error: "Invalid or expired authorization token" });
        return;
      }
    } catch (err) {
      // Outside production, allow the dev API key through for local testing.
      // In production the dev key is never accepted (no impersonation backdoor).
      const devKey = process.env.MCP_DEV_API_KEY;
      if (!(process.env.NODE_ENV !== "production" && devKey && code === devKey)) {
        res.status(401).json({ error: "Token verification failed" });
        return;
      }
    }
  } else if (process.env.NODE_ENV === "production") {
    // Fail closed: never issue tokens in production without a configured verifier.
    console.error("[OAuth] PRIVY_APP_ID/PRIVY_APP_SECRET not configured — refusing to issue token in production.");
    res.status(503).json({ error: "Authorization service unavailable" });
    return;
  }

  res.json({
    access_token: code,
    token_type: "Bearer",
    expires_in: 86400,
  });
});

// ── Application routes ───────────────────────────────────────────────────────
app.use("/users", userRoutes);
app.use("/transactions", transactionRoutes);
app.use("/savings-activity", savingsRoutes);
app.use("/stocks", stockRoutes);
app.use("/withdrawals", withdrawalRoutes);
app.use("/gas-sponsorship", gasSponsorshipRoutes);
app.use("/paj-session", pajSessionRoutes);
app.use("/ai", aiRoutes);
app.use("/admin", adminRoutes);
app.use("/investments", investRoutes);

// ── Third-party integration routes ───────────────────────────────────────────
app.use("/fonbnk/africa", africaRoutes);
app.use("/api/webhooks", heliusWebhookRoutes);
app.use("/webhook/paj-ramp", pajWebhookRoutes);
app.use("/api/inngest", serve({ client: inngest, functions: [sendWeeklyYieldEmails] }));

// ── Backward-compatible route aliases ────────────────────────────────────────
// These preserve the original URL paths so the frontend doesn't need changes.
import { getStockHistory, getStockHoldings, createStockPurchase, createStockSale } from "./controllers/stockController.js";
app.get("/stock-history/:privyUserId", getStockHistory);
app.get("/stock-holdings/:privyUserId", getStockHoldings);
app.post("/stock-purchases", createStockPurchase);
app.post("/stock-sales", createStockSale);

import { processAutomatedBackgroundWithdrawalClaims } from "./services/privyWalletService.js";

// ── Background Auto-Claim Worker ─────────────────────────────────────────────
// Scans pending withdrawals whose 24h cooldown has expired every 5 minutes and auto-claims them into the user's wallet
setInterval(() => {
  processAutomatedBackgroundWithdrawalClaims().catch((err) =>
    console.error("[AutoClaimWorker] Background interval error:", err)
  );
}, 5 * 60 * 1000);

// ── Bootstrap ────────────────────────────────────────────────────────────────
runMigrations().catch((err) => {
  console.error("[migrations] Fatal error during schema bootstrap:", err);
  process.exit(1);
});

app.listen(port, () => {
  console.log(`Backend server listening on port ${port}`);
});
