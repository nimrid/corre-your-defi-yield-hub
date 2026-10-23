/**
 * Pay.sh Helper — HTTP 402 Handshake Engine
 *
 * Bridges the pay.sh (Solana HTTP 402 payment protocol) with the existing
 * Privy wallet signing infrastructure. Implements:
 * - Catalog browsing via the pay-skills registry
 * - 402 challenge parsing (MPP WWW-Authenticate header)
 * - Payment proof construction using Privy server-side signing
 *
 * Protocol reference: https://pay.sh/docs/building-with-pay/getting-started
 */

// ── Types ──────────────────────────────────────────────────────────────────────

/** A provider entry from the pay.sh skills catalog */
export interface PayshProvider {
  fqn: string;
  title: string;
  description: string;
  use_case: string;
  category: string;
  service_url: string;
  endpoint_count: number;
  has_metering: boolean;
  has_free_tier: boolean;
  min_price_usd: number;
  max_price_usd: number;
  sha: string;
}

/** Parsed 402 challenge from the WWW-Authenticate header */
export interface PayshChallenge {
  challengeId: string;
  realm: string;
  method: string;        // "solana"
  intent: string;        // "charge", "upto", etc.
  description: string;
  expiresAt: string;
  request: PayshPaymentRequest;
  rawHeader?: string;
  schemaHint?: any;
}

/** Decoded payment request from the 402 challenge */
export interface PayshPaymentRequest {
  amount: string;           // Raw amount in base units (e.g. "10000" = $0.01 USDC)
  currency: string;         // SPL token mint address (USDC)
  recipient: string;        // Operator wallet address
  methodDetails: {
    decimals: number;
    feePayer: boolean;
    feePayerKey?: string;
    network: string;        // "mainnet-beta", "localnet", etc.
    recentBlockhash?: string;
    tokenProgram: string;
  };
}

/** Result of a paid API call */
export interface PayshCallResult {
  success: boolean;
  // API response
  statusCode?: number;
  responseBody?: any;
  responseHeaders?: Record<string, string>;
  // Payment details
  txSignature?: string;
  amountPaidUsd?: number;
  amountPaidRaw?: string;
  recipientAddress?: string;
  solscanUrl?: string;
  // Error info
  error?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const PAYSH_CATALOG_URL = "https://catalog.pay.sh/v1/skills.json";
const PAYSH_PROVIDER_BASE = "https://catalog.pay.sh/v1/providers";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDC_DECIMALS = 6;

// Maximum amount per single pay.sh API call (in USDC)
const MAX_PAYSH_CALL_AMOUNT_USDC = 5;

// Cache catalog for 10 minutes to avoid hammering the registry
let catalogCache: { providers: PayshProvider[]; fetchedAt: number } | null = null;
const CATALOG_CACHE_TTL_MS = 10 * 60 * 1000;

// ── Catalog Functions ──────────────────────────────────────────────────────────

/**
 * Fetches the pay.sh provider catalog from the pay-skills registry.
 * Results are cached for 10 minutes.
 */
export async function fetchPayshCatalog(): Promise<PayshProvider[]> {
  if (catalogCache && Date.now() - catalogCache.fetchedAt < CATALOG_CACHE_TTL_MS) {
    return catalogCache.providers;
  }

  const response = await fetch(PAYSH_CATALOG_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch pay.sh catalog: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as any;
  const providers: PayshProvider[] = data.providers || [];

  catalogCache = { providers, fetchedAt: Date.now() };
  return providers;
}

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "book", "by", "can", "do", "for",
  "from", "get", "how", "i", "in", "is", "it", "me", "my", "of", "on", "or",
  "our", "please", "the", "this", "to", "us", "want", "we", "with", "you", "your"
]);

const SYNONYMS: Record<string, string[]> = {
  flight: ["flight", "flights", "airline", "airfare", "plane", "fly", "air", "travel", "brij"],
  flights: ["flight", "flights", "airline", "airfare", "plane", "fly", "air", "travel", "brij"],
  fly: ["flight", "flights", "airline", "airfare", "plane", "air", "brij"],
  airline: ["flight", "flights", "airline", "airfare", "travel", "brij"],
  airfare: ["flight", "flights", "airline", "airfare", "brij"],
  airport: ["flight", "flights", "airline", "air", "travel", "brij"],
  travel: ["travel", "flight", "flights", "hotel", "trip", "tripadvisor", "airline", "vacation"],
  trip: ["travel", "flight", "hotel", "tripadvisor", "trip"],
  hotel: ["hotel", "hotels", "tripadvisor", "lodging", "travel"],
  booking: ["booking", "book", "reservation", "reservations", "order", "intent", "brij"],
  reservation: ["reservation", "reservations", "agentres", "restaurant", "booking"],
  restaurant: ["restaurant", "dining", "food", "agentres", "reservations"],
  email: ["email", "mail", "inbox", "agentmail", "messaging"],
  crypto: ["crypto", "token", "defi", "birdeye", "solana", "usdc", "swap"],
  market: ["market", "finance", "birdeye", "crypto", "stock", "data"],
  maps: ["map", "maps", "location", "places", "tripadvisor"],
  gift: ["gift", "giftcard", "giftcards", "voucher", "cryptorefills", "card", "cards", "shopping"],
  giftcard: ["gift", "giftcard", "giftcards", "voucher", "cryptorefills", "card", "shopping"],
  giftcards: ["gift", "giftcard", "giftcards", "voucher", "cryptorefills", "card", "shopping"],
  card: ["card", "cards", "gift", "giftcard", "cryptorefills", "voucher"],
  cards: ["card", "cards", "gift", "giftcard", "cryptorefills", "voucher"],
  voucher: ["voucher", "vouchers", "gift", "giftcard", "cryptorefills"],
  topup: ["topup", "recharge", "esim", "mobile", "cryptorefills"],
  esim: ["esim", "mobile", "data", "cryptorefills", "roaming"],
  birdeye: ["birdeye", "crypto", "defi", "token", "ohlcv", "price", "analytics", "data"],
  defi: ["defi", "birdeye", "token", "crypto", "solana", "finance"],
  analytics: ["analytics", "birdeye", "data", "metrics", "chart", "ohlcv"],
  ohlcv: ["ohlcv", "birdeye", "chart", "candlestick", "price"],
  token: ["token", "tokens", "birdeye", "crypto", "defi", "price"],
};

/**
 * Searches the pay.sh catalog by query string and/or category.
 * Uses smart tokenization, synonym expansion, and relevance scoring.
 */
export async function searchPayshCatalog(
  query?: string,
  category?: string
): Promise<PayshProvider[]> {
  const providers = await fetchPayshCatalog();

  const trimmedQuery = (query || "").trim();
  const trimmedCategory = (category || "").trim().toLowerCase();

  // If no search parameters provided, return all
  if (!trimmedQuery && !trimmedCategory) {
    return providers;
  }

  // Tokenize query words
  const words = trimmedQuery
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));

  const scored = providers
    .map((p) => {
      let score = 0;
      const title = (p.title || "").toLowerCase();
      const desc = (p.description || "").toLowerCase();
      const useCase = (p.use_case || "").toLowerCase();
      const fqn = (p.fqn || "").toLowerCase();
      const cat = (p.category || "").toLowerCase();

      // Category matching with smart alias handling (e.g. "travel" matches brij/travel & tripadvisor)
      if (trimmedCategory) {
        if (cat === trimmedCategory) {
          score += 15;
        } else if (
          trimmedCategory === "travel" &&
          (fqn.includes("travel") || desc.includes("flight") || desc.includes("travel") || title.includes("flight"))
        ) {
          score += 20;
        } else if (score === 0 && words.length === 0) {
          return { provider: p, score: 0 };
        }
      }

      // Exact phrase match in title or description gets a massive boost
      if (trimmedQuery.length > 2) {
        const qLower = trimmedQuery.toLowerCase();
        if (title.includes(qLower)) score += 40;
        if (desc.includes(qLower)) score += 25;
        if (useCase.includes(qLower)) score += 20;
        if (fqn.includes(qLower)) score += 30;
      }

      // Token and synonym matching
      for (const token of words) {
        const variants = SYNONYMS[token] || [token];
        for (const v of variants) {
          if (title.includes(v)) score += 12;
          if (fqn.includes(v)) score += 10;
          if (desc.includes(v)) score += 6;
          if (useCase.includes(v)) score += 5;
          if (cat.includes(v)) score += 3;
        }
      }

      return { provider: p, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length > 0) {
    return scored.map((s) => s.provider);
  }

  // Fallback: loose substring matching if tokenization found no matches
  if (trimmedQuery) {
    const q = trimmedQuery.toLowerCase();
    return providers.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.use_case.toLowerCase().includes(q) ||
        p.fqn.toLowerCase().includes(q)
    );
  }

  return [];
}

/**
 * Fetches detailed provider info with real OpenAPI documentation support.
 * First tries the provider's live /openapi.json endpoint, then falls back to catalog metadata.
 */
export async function fetchProviderDetails(fqn: string): Promise<any> {
  const providers = await fetchPayshCatalog();
  const provider = providers.find(
    (p) => p.fqn.toLowerCase() === fqn.toLowerCase() || p.service_url.toLowerCase().includes(fqn.toLowerCase())
  );

  // 1. If provider has a service_url, try fetching its OpenAPI spec directly
  if (provider?.service_url) {
    try {
      const openApiUrl = `${provider.service_url.replace(/\/+$/, "")}/openapi.json`;
      const res = await fetch(openApiUrl, { signal: AbortSignal.timeout(3500) });
      if (res.ok) {
        const spec = await res.json() as any;
        const paths = spec.paths || {};
        const simplifiedEndpoints = Object.entries(paths).map(([path, methods]: [string, any]) => {
          const methodList = Object.keys(methods);
          const firstMethod = methodList[0] || "GET";
          const details = methods[firstMethod] || {};
          return {
            path,
            method: firstMethod.toUpperCase(),
            summary: details.summary || details.description || "",
            parameters: details.parameters || undefined,
            requestBody: details.requestBody ? "Required/Supported (see OpenAPI)" : undefined,
          };
        });

        return {
          fqn: provider.fqn,
          title: provider.title,
          description: provider.description,
          use_case: provider.use_case,
          category: provider.category,
          gatewayUrl: provider.service_url,
          openApiUrl,
          pricing: {
            minPriceUsd: provider.min_price_usd,
            maxPriceUsd: provider.max_price_usd,
            hasFreeTier: provider.has_free_tier,
          },
          endpoints: simplifiedEndpoints,
        };
      }
    } catch {
      // Fall through to catalog info
    }
  }

  // 2. Try the pay-skills registry URL
  try {
    const url = `${PAYSH_PROVIDER_BASE}/${fqn}.json`;
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (response.ok) {
      return await response.json();
    }
  } catch {
    // Fall through
  }

  // 3. Fallback: return provider info from catalog
  if (provider) {
    return {
      fqn: provider.fqn,
      title: provider.title,
      description: provider.description,
      use_case: provider.use_case,
      category: provider.category,
      gatewayUrl: provider.service_url,
      pricing: {
        minPriceUsd: provider.min_price_usd,
        maxPriceUsd: provider.max_price_usd,
        hasFreeTier: provider.has_free_tier,
      },
      note: "Full OpenAPI spec not available via standard path. Use paysh_get_pricing with gatewayUrl to inspect specific endpoints.",
    };
  }

  throw new Error(`Provider "${fqn}" not found in pay.sh catalog.`);
}

// ── 402 Challenge Parsing ──────────────────────────────────────────────────────

/**
 * Parses the WWW-Authenticate header from a 402 response into a structured challenge.
 *
 * Format: Payment id="...", realm="...", method="solana", intent="charge",
 *         request="<base64url-encoded JSON>", description="...", expires="..."
 */
export function parseWwwAuthenticateChallenge(header: string): PayshChallenge | null {
  if (!header || !header.startsWith("Payment ")) return null;

  const params = header.substring("Payment ".length);
  const parsed: Record<string, string> = {};

  // Parse key="value" pairs from the WWW-Authenticate header.
  // Values are always double-quoted per RFC 7235.
  const regex = /(\w+)="([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(params)) !== null) {
    parsed[match[1]] = match[2];
  }

  if (!parsed.id || !parsed.request) return null;

  // Decode the base64url-encoded payment request
  let paymentRequest: PayshPaymentRequest;
  try {
    // Pad the base64url string and decode
    let b64 = parsed.request.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4 !== 0) b64 += "=";
    const decoded = Buffer.from(b64, "base64").toString("utf-8");
    paymentRequest = JSON.parse(decoded);
  } catch (err) {
    console.error("[PaySH] Failed to decode payment request:", err);
    return null;
  }

  return {
    challengeId: parsed.id,
    realm: parsed.realm || "",
    method: parsed.method || "solana",
    intent: parsed.intent || "charge",
    description: parsed.description || "",
    expiresAt: parsed.expires || "",
    request: paymentRequest,
    rawHeader: header,
  };
}

// ── 402 Challenge Parsing (v1 Headers & v2 Body) ─────────────────────────────

/**
 * Parses a 402 response from either:
 * - RFC 7235 WWW-Authenticate header (v1)
 * - JSON response body with x402Version: 2 (v2, as used by Pay.sh and BRIJ)
 */
export function parse402Challenge(response: Response, bodyText: string): PayshChallenge | null {
  // 1. Try WWW-Authenticate header (v1 format)
  const wwwAuth = response.headers.get("www-authenticate");
  if (wwwAuth && wwwAuth.startsWith("Payment ")) {
    const v1 = parseWwwAuthenticateChallenge(wwwAuth);
    if (v1) return v1;
  }

  // 2. Try JSON response body (v2 format, e.g. x402Version: 2)
  try {
    const json = JSON.parse(bodyText);
    if (json.x402Version && Array.isArray(json.accepts) && json.accepts.length > 0) {
      // Find Solana accept option (prefer exact scheme and USDC)
      const solanaAccept =
        json.accepts.find(
          (a: any) =>
            typeof a.network === "string" &&
            a.network.startsWith("solana") &&
            (a.asset === USDC_MINT || a.scheme === "exact")
        ) || json.accepts[0];

      if (solanaAccept && solanaAccept.payTo) {
        return {
          challengeId: json.resource?.url || `x402v2_${Date.now()}`,
          realm: json.resource?.description || "",
          method: "solana",
          intent: solanaAccept.scheme || "charge",
          description: json.resource?.description || "x402 API Payment",
          expiresAt: solanaAccept.maxTimeoutSeconds
            ? new Date(Date.now() + solanaAccept.maxTimeoutSeconds * 1000).toISOString()
            : "",
          request: {
            amount: String(solanaAccept.amount || "0"),
            currency: solanaAccept.asset || USDC_MINT,
            recipient: solanaAccept.payTo,
            methodDetails: {
              decimals: USDC_DECIMALS,
              feePayer: !!solanaAccept.extra?.feePayer,
              feePayerKey: solanaAccept.extra?.feePayer,
              network: solanaAccept.network || "mainnet-beta",
              tokenProgram: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
            },
          },
          rawHeader: wwwAuth || undefined,
          schemaHint:
            json.extensions?.bazaar?.info?.input?.body ||
            json.extensions?.bazaar?.schema?.properties?.input?.properties?.body?.properties ||
            undefined,
        };
      }
    }
  } catch {
    // Ignore JSON parsing failure
  }

  return null;
}

/**
 * Sends a preflight request to a pay.sh gateway URL and parses the 402 challenge
 * to extract pricing information and input schema — without making any payment.
 */
export async function fetchEndpointPricing(
  gatewayUrl: string,
  method: string = "GET",
  path: string = "",
  body?: any
): Promise<{
  is402: boolean;
  challenge?: PayshChallenge;
  priceUsd?: number;
  recipient?: string;
  description?: string;
  expiresAt?: string;
  schemaHint?: any;
  error?: string;
}> {
  const fullUrl = path ? `${gatewayUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}` : gatewayUrl;

  try {
    const fetchOptions: RequestInit = {
      method: method.toUpperCase(),
      headers: { "Content-Type": "application/json" },
    };
    if (body && method.toUpperCase() !== "GET") {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(fullUrl, fetchOptions);

    if (response.status !== 402) {
      return {
        is402: false,
        error: `Endpoint returned ${response.status} instead of 402. This may be a free endpoint or not pay.sh-gated.`,
      };
    }

    const responseText = await response.text();
    const challenge = parse402Challenge(response, responseText);
    if (!challenge) {
      return {
        is402: true,
        error: "402 response received but failed to parse payment challenge from headers or JSON body.",
      };
    }

    const amountRaw = BigInt(challenge.request.amount);
    const decimals = challenge.request.methodDetails.decimals || USDC_DECIMALS;
    const priceUsd = Number(amountRaw) / Math.pow(10, decimals);

    return {
      is402: true,
      challenge,
      priceUsd,
      recipient: challenge.request.recipient,
      description: challenge.description,
      expiresAt: challenge.expiresAt,
      schemaHint: challenge.schemaHint,
    };
  } catch (err: any) {
    return {
      is402: false,
      error: `Failed to reach endpoint: ${err?.message || err}`,
    };
  }
}

/**
 * Inspects a provider's full OpenAPI documentation and returns structured,
 * LLM-optimized parameter schemas for all endpoints or a specific target path.
 */
export async function getProviderApiDocs(
  gatewayUrlOrFqn: string,
  targetPath?: string
): Promise<any> {
  const providers = await fetchPayshCatalog();
  const inputLower = gatewayUrlOrFqn.toLowerCase().trim();

  // Find provider by FQN or gateway URL
  const provider = providers.find(
    (p) =>
      p.fqn.toLowerCase() === inputLower ||
      p.service_url.toLowerCase().includes(inputLower) ||
      inputLower.includes(p.service_url.toLowerCase())
  );

  const serviceUrl = (provider ? provider.service_url : gatewayUrlOrFqn).replace(/\/+$/, "");

  // Fetch OpenAPI spec
  let spec: any = null;
  try {
    const res = await fetch(`${serviceUrl}/openapi.json`, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      spec = await res.json();
    }
  } catch {
    // Ignore
  }

  if (!spec && provider?.fqn) {
    try {
      const res = await fetch(`${PAYSH_PROVIDER_BASE}/${provider.fqn}.json`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const provData = await res.json() as any;
        if (provData.openapi_doc && typeof provData.openapi_doc === "object") {
          spec = provData.openapi_doc;
        } else if (provData.openapi_doc && typeof provData.openapi_doc === "string") {
          spec = JSON.parse(provData.openapi_doc);
        }
      }
    } catch {
      // Ignore
    }
  }

  if (!spec) {
    // Fall back to general provider summary if openapi.json is not directly exposed
    return {
      provider: provider?.title || gatewayUrlOrFqn,
      gatewayUrl: serviceUrl,
      note: "Standard /openapi.json not detected. Use paysh_get_pricing with path to trigger 402 schema preview.",
    };
  }

  const paths = spec.paths || {};

  // If a specific path was requested, return detailed documentation for that endpoint
  if (targetPath) {
    const normalizedPath = targetPath.startsWith("/") ? targetPath : `/${targetPath}`;
    const pathItem = paths[normalizedPath];
    if (!pathItem) {
      return {
        error: `Path "${normalizedPath}" not found in API spec.`,
        availablePaths: Object.keys(paths),
      };
    }

    const method = Object.keys(pathItem)[0] || "get";
    const details = pathItem[method] || {};
    const schemaRef = details.requestBody?.content?.["application/json"]?.schema?.$ref;
    let bodySchema = details.requestBody?.content?.["application/json"]?.schema;

    if (schemaRef && spec.components?.schemas) {
      const compName = schemaRef.split("/").pop();
      bodySchema = spec.components.schemas[compName] || bodySchema;
    }

    return {
      gatewayUrl: serviceUrl,
      path: normalizedPath,
      method: method.toUpperCase(),
      summary: details.summary || details.description || "",
      parameters: details.parameters || [],
      requestBodySchema: bodySchema || undefined,
    };
  }

  // Return a clean summary list of all endpoints
  const endpoints = Object.entries(paths).map(([p, methods]: [string, any]) => {
    const methodList = Object.keys(methods);
    const m = methodList[0] || "get";
    const details = methods[m] || {};
    return {
      path: p,
      method: m.toUpperCase(),
      summary: details.summary || details.description || "",
    };
  });

  return {
    provider: provider?.title || spec.info?.title || gatewayUrlOrFqn,
    description: provider?.description || spec.info?.description || "",
    gatewayUrl: serviceUrl,
    totalEndpoints: endpoints.length,
    endpoints,
  };
}

// ── Payment Execution ──────────────────────────────────────────────────────────

/**
 * Executes a full pay.sh 402 handshake:
 * 1. Sends initial request → receives 402 challenge
 * 2. Parses challenge (amount, recipient, asset)
 * 3. Builds USDC transfer transaction
 * 4. Signs via Privy wallet API
 * 5. Retries request with X-PAYMENT header containing the signed tx
 *
 * @param gatewayUrl - The pay.sh gateway endpoint URL
 * @param method - HTTP method (GET, POST, etc.)
 * @param path - Optional path to append to gatewayUrl
 * @param body - Optional request body (for POST/PUT)
 * @param headers - Optional additional request headers
 * @param walletAddress - User's Solana wallet address
 * @param walletId - Privy wallet ID for server-side signing
 */
export async function executePayshRequest(params: {
  gatewayUrl: string;
  method?: string;
  path?: string;
  body?: any;
  headers?: Record<string, string>;
  walletAddress: string;
  walletId: string;
}): Promise<PayshCallResult> {
  const {
    gatewayUrl,
    method = "GET",
    path = "",
    body,
    headers: extraHeaders = {},
    walletAddress,
    walletId,
  } = params;

  const fullUrl = path
    ? `${gatewayUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`
    : gatewayUrl;

  // ── Step 1: Initial request → get 402 challenge ────────────────────────────
  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...extraHeaders,
  };

  const fetchOptions: RequestInit = {
    method: method.toUpperCase(),
    headers: requestHeaders,
  };
  if (body && method.toUpperCase() !== "GET") {
    fetchOptions.body = JSON.stringify(body);
  }

  let challengeResponse: Response;
  try {
    challengeResponse = await fetch(fullUrl, fetchOptions);
  } catch (err: any) {
    return { success: false, error: `Failed to reach endpoint: ${err?.message || err}` };
  }

  // If the endpoint doesn't return 402, return the response directly (it's free!)
  if (challengeResponse.status !== 402) {
    const responseBody = await challengeResponse.text();
    let parsed: any;
    try { parsed = JSON.parse(responseBody); } catch { parsed = responseBody; }

    return {
      success: true,
      statusCode: challengeResponse.status,
      responseBody: parsed,
      amountPaidUsd: 0,
    };
  }

  // ── Step 2: Parse 402 challenge (Headers or Body) ─────────────────────────
  const challengeBodyText = await challengeResponse.text();
  const challenge = parse402Challenge(challengeResponse, challengeBodyText);
  if (!challenge) {
    return { success: false, error: "Failed to parse payment challenge from 402 headers or JSON body." };
  }

  // Validate the payment request
  const amountRaw = BigInt(challenge.request.amount);
  const decimals = challenge.request.methodDetails.decimals || USDC_DECIMALS;
  const amountUsd = Number(amountRaw) / Math.pow(10, decimals);

  if (amountUsd > MAX_PAYSH_CALL_AMOUNT_USDC) {
    return {
      success: false,
      error: `API call costs $${amountUsd.toFixed(6)} USDC, which exceeds the per-call limit of $${MAX_PAYSH_CALL_AMOUNT_USDC} USDC.`,
    };
  }

  // Verify the currency is USDC
  if (challenge.request.currency !== USDC_MINT) {
    return {
      success: false,
      error: `Unsupported payment currency: ${challenge.request.currency}. Only USDC is supported.`,
    };
  }

  // Check expiry
  if (challenge.expiresAt) {
    const expiryTime = new Date(challenge.expiresAt).getTime();
    if (Date.now() > expiryTime) {
      return { success: false, error: "Payment challenge has expired. Please retry." };
    }
  }

  // ── Step 3: Build USDC transfer transaction ────────────────────────────────
  const { buildUsdcTransferTx, signViaPrivy } = await import(
    "../../services/privyWalletService.js"
  );

  let txBase64: string;
  try {
    txBase64 = await buildUsdcTransferTx(
      walletAddress,
      challenge.request.recipient,
      amountUsd
    );
  } catch (err: any) {
    return {
      success: false,
      error: `Failed to build payment transaction: ${err?.message || err}`,
    };
  }

  // ── Step 4: Sign via Privy wallet ──────────────────────────────────────────
  let signedTxBase64: string;
  try {
    signedTxBase64 = await signViaPrivy(walletId, txBase64);
  } catch (err: any) {
    return {
      success: false,
      error: `Failed to sign payment transaction: ${err?.message || err}`,
    };
  }

  // ── Step 5: Retry with payment proof ───────────────────────────────────────
  // Support both modern x402 v2 (Payment-Signature) and v1 (X-PAYMENT)
  const paidRequestHeaders: Record<string, string> = {
    ...requestHeaders,
    "Payment-Signature": signedTxBase64,
    "X-PAYMENT": signedTxBase64,
    "X-PAYMENT-ID": challenge.challengeId,
  };

  const paidFetchOptions: RequestInit = {
    method: method.toUpperCase(),
    headers: paidRequestHeaders,
  };
  if (body && method.toUpperCase() !== "GET") {
    paidFetchOptions.body = JSON.stringify(body);
  }

  let paidResponse: Response;
  try {
    paidResponse = await fetch(fullUrl, paidFetchOptions);
  } catch (err: any) {
    return {
      success: false,
      error: `Failed to send paid request: ${err?.message || err}`,
      txSignature: undefined,
      amountPaidUsd: amountUsd,
    };
  }

  // Extract payment receipt from response headers
  const paymentReceipt = paidResponse.headers.get("payment-receipt");
  const txSignature = paidResponse.headers.get("x-payment-response") || paymentReceipt || "";

  // Parse response body
  const responseText = await paidResponse.text();
  let responseBody: any;
  try { responseBody = JSON.parse(responseText); } catch { responseBody = responseText; }

  // Collect relevant response headers
  const responseHeaders: Record<string, string> = {};
  for (const [key, value] of paidResponse.headers.entries()) {
    if (key.startsWith("x-") || key === "content-type" || key === "payment-receipt") {
      responseHeaders[key] = value;
    }
  }

  let errorDetail: string | undefined = undefined;
  if (!paidResponse.ok) {
    let msg = `API returned HTTP ${paidResponse.status}`;
    if (responseBody && typeof responseBody === "object") {
      if (responseBody.error) msg += `: ${typeof responseBody.error === "string" ? responseBody.error : JSON.stringify(responseBody.error)}`;
      else if (responseBody.message) msg += `: ${responseBody.message}`;
    }
    if (challenge.schemaHint) {
      msg += `. Expected schema: ${JSON.stringify(challenge.schemaHint)}`;
    }
    errorDetail = msg;
  }

  return {
    success: paidResponse.ok,
    statusCode: paidResponse.status,
    responseBody,
    responseHeaders,
    txSignature,
    amountPaidUsd: amountUsd,
    amountPaidRaw: challenge.request.amount,
    recipientAddress: challenge.request.recipient,
    solscanUrl: txSignature ? `https://solscan.io/tx/${txSignature}` : undefined,
    error: errorDetail,
  };
}
