/**
 * Pay.sh MCP Tools — Paid API Access via HTTP 402
 *
 * Exposes pay.sh (Solana-based agentic API payments) as MCP tools:
 * - paysh_search_apis: Browse/search the pay.sh catalog of 74+ paid APIs
 * - paysh_get_pricing: Preview pricing for a specific API endpoint
 * - paysh_call_api: Make a paid API call using the user's Privy wallet
 *
 * All payment signing is done server-side via the Privy Wallet API,
 * reusing the existing infrastructure in privyWalletService.ts.
 */

import type { MCPTool, MCPContext } from "../types.js";
import { authRequiredResult } from "../auth.js";
import { lookupUserWallet } from "../../services/privyWalletService.js";
import {
  searchPayshCatalog,
  fetchProviderDetails,
  fetchEndpointPricing,
  executePayshRequest,
  getProviderApiDocs,
} from "../helpers/paysh.js";
import { inngest } from "../../inngest/client.js";

export const payshTools: MCPTool[] = [
  // ── paysh_search_apis ──────────────────────────────────────────────────────
  {
    definition: {
      name: "paysh_search_apis",
      description:
        "Search the pay.sh catalog of 74+ paid APIs that AI agents can call with USDC payments. " +
        "Includes flight search and booking (brij/travel), restaurant reservations (agentres), emails, crypto data, and more. " +
        "Categories include: travel, shopping, ai_ml, finance, data, search, maps, messaging, media, compute, productivity. " +
        "Returns provider name, description, pricing range, gateway URL, and sample usage.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Search term to filter APIs by name, description, or use case (e.g. 'flight', 'flights', 'travel', 'hotel', 'weather', 'email', 'crypto')",
          },
          category: {
            type: "string",
            description:
              "Filter by category: travel, shopping, ai_ml, finance, data, search, maps, messaging, media, compute, productivity",
          },
        },
      },
    },
    handler: async (args) => {
      const query = args?.query as string | undefined;
      const category = args?.category as string | undefined;

      try {
        const providers = await searchPayshCatalog(query, category);

        if (providers.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    status: "no_results",
                    message: query || category
                      ? `No pay.sh APIs found matching ${query ? `"${query}"` : ""}${category ? ` in category "${category}"` : ""}. Try a broader search or browse all by omitting the query.`
                      : "The pay.sh catalog appears to be empty or unreachable.",
                    catalogUrl: "https://pay.sh",
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        // Common quickstart templates for top services
        const QUICKSTARTS: Record<string, any> = {
          "brij/travel": {
            description: "Live flight search and on-chain escrow booking across global airlines.",
            searchFlights: {
              method: "POST",
              path: "/air/search",
              sampleBody: {
                origin_iata: "LOS",
                destination_iata: "LHR",
                depart_date: "2026-10-15",
                adults: 1,
                cabin_class: "economy"
              },
              cost: "$0.10 USDC per search",
              howToCall: "Call paysh_call_api with gatewayUrl='https://travel.brij.fi', method='POST', path='/air/search', body={origin_iata, destination_iata, depart_date, adults}"
            },
            bookFlight: {
              method: "POST",
              path: "/air/intents",
              cost: "Escrow-backed ticket price in USDC",
              howToCall: "Create intent via /air/intents with offer ID, then book via /air/book"
            },
            openApiUrl: "https://travel.brij.fi/openapi.json"
          },
          "agentres/reservations": {
            description: "Book, list, and cancel Resy restaurant reservations.",
            openApiUrl: "https://x402.api.agentres.com/openapi.json"
          },
          "agentmail/email": {
            description: "Create inboxes and send/receive emails programmatically.",
            openApiUrl: "https://x402.api.agentmail.to/openapi.json"
          },
          "cryptorefills/shopping": {
            description: "Buy gift cards (Amazon, Apple, Steam, etc.), mobile top-ups, and eSIMs across 180 countries with USDC on Solana.",
            gatewayUrl: "https://solana.x402.cryptorefills.com",
            listBrands: {
              method: "GET",
              path: "/v1/brands?country_code=us",
              howToCall: "Call paysh_call_api with gatewayUrl='https://solana.x402.cryptorefills.com', method='GET', path='/v1/brands?country_code=us'"
            },
            viewCatalog: {
              method: "GET",
              path: "/v1/catalog?country_code=us&brand_id=amazon",
              howToCall: "Call paysh_call_api with path='/v1/catalog?country_code=us&brand_id=amazon' to see available denominations"
            },
            buyGiftCard: {
              method: "POST",
              path: "/v1/orders",
              sampleBody: {
                email: "customer@example.com",
                items: [{ product_id: "amazon_us_25", quantity: 1 }]
              },
              howToCall: "Call paysh_call_api with method='POST', path='/v1/orders', body={email, items} — payment is handled via Privy USDC transfer"
            },
            getOrderVoucher: {
              method: "GET",
              path: "/v1/orders/{order_id}",
              howToCall: "Poll /v1/orders/{order_id} to retrieve the voucher code and redemption pin"
            }
          },
          "birdeye/data": {
            description: "DeFi market data, token prices, OHLCV charts, and wallet analytics across Solana.",
            gatewayUrl: "https://public-api.birdeye.so",
            getTokenPrice: {
              method: "GET",
              path: "/x402/defi/price?address=So11111111111111111111111111111111111111112",
              howToCall: "Call paysh_call_api with gatewayUrl='https://public-api.birdeye.so', method='GET', path='/x402/defi/price?address=<MINT>'"
            },
            getOhlcv: {
              method: "GET",
              path: "/x402/defi/ohlcv?address=<MINT>&type=15m",
              howToCall: "Call paysh_call_api with path='/x402/defi/ohlcv?address=<MINT>&type=15m'"
            },
            getTokenSecurity: {
              method: "GET",
              path: "/x402/defi/token_security?address=<MINT>",
              howToCall: "Call paysh_call_api with path='/x402/defi/token_security?address=<MINT>'"
            }
          }
        };

        // Format results concisely
        const results = providers.map((p) => ({
          name: p.title,
          fqn: p.fqn,
          category: p.category,
          description: p.description,
          use_case: p.use_case,
          gatewayUrl: p.service_url,
          endpoints: p.endpoint_count,
          quickstart: QUICKSTARTS[p.fqn] || undefined,
          pricing: {
            hasFreeTier: p.has_free_tier,
            hasMetering: p.has_metering,
            minPriceUsd: p.min_price_usd,
            maxPriceUsd: p.max_price_usd,
            priceRange:
              p.min_price_usd === p.max_price_usd
                ? `$${p.min_price_usd} USDC`
                : `$${p.min_price_usd} – $${p.max_price_usd} USDC`,
          },
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "success",
                  totalResults: results.length,
                  query: query || undefined,
                  category: category || undefined,
                  apis: results,
                  note: "To call any API, use paysh_call_api with the provider's gatewayUrl, method, path, and body. For full endpoint details, use paysh_get_pricing with fqn or gatewayUrl.",
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error searching pay.sh catalog: ${err?.message || err}`,
            },
          ],
        };
      }
    },
  },

  // ── paysh_get_api_docs ─────────────────────────────────────────────────────
  {
    definition: {
      name: "paysh_get_api_docs",
      description:
        "Inspect OpenAPI documentation, available endpoints, and parameter schemas for any pay.sh API provider (e.g. 'brij/travel', 'agentres/reservations', 'agentmail/email'). " +
        "Call this tool to understand the exact JSON body, required fields, and path parameters before invoking paysh_call_api. " +
        "Pass gatewayUrl or fqn to list all endpoints, or specify a path (e.g. '/air/search') to get detailed request body specifications.",
      inputSchema: {
        type: "object",
        properties: {
          gatewayUrl: {
            type: "string",
            description:
              "The provider gateway URL (e.g. 'https://travel.brij.fi') or FQN identifier (e.g. 'brij/travel').",
          },
          path: {
            type: "string",
            description:
              "Optional endpoint path to inspect in detail (e.g. '/air/search', '/v1/inbox', '/quote/AAPL'). If omitted, lists all available endpoints.",
          },
        },
        required: ["gatewayUrl"],
      },
    },
    handler: async (args) => {
      const gatewayUrl = args?.gatewayUrl as string | undefined;
      const path = args?.path as string | undefined;

      if (!gatewayUrl) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "gatewayUrl or fqn is required to inspect API documentation.",
            },
          ],
        };
      }

      try {
        const docs = await getProviderApiDocs(gatewayUrl, path);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(docs, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error fetching API docs: ${err?.message || err}`,
            },
          ],
        };
      }
    },
  },

  // ── paysh_get_pricing ──────────────────────────────────────────────────────
  {
    definition: {
      name: "paysh_get_pricing",
      description:
        "Preview the pricing for a specific pay.sh API endpoint before calling it. " +
        "Sends a preflight request to trigger the 402 challenge and extracts the cost, " +
        "payment recipient, and expiry — without making any payment.",
      inputSchema: {
        type: "object",
        properties: {
          gatewayUrl: {
            type: "string",
            description:
              "The pay.sh gateway URL to check pricing for (from paysh_search_apis results)",
          },
          method: {
            type: "string",
            description: "HTTP method (GET, POST, etc.). Defaults to GET.",
          },
          path: {
            type: "string",
            description:
              "API path to append to the gateway URL (e.g. '/v1/translate' or '/quote/AAPL')",
          },
          fqn: {
            type: "string",
            description:
              "Provider FQN (e.g. 'birdeye/data') to fetch full provider spec with all endpoints and pricing details",
          },
        },
        required: [],
      },
    },
    handler: async (args) => {
      const gatewayUrl = args?.gatewayUrl as string | undefined;
      const method = (args?.method as string) || "GET";
      const path = args?.path as string | undefined;
      const fqn = args?.fqn as string | undefined;

      try {
        // If FQN is provided, fetch the full provider details from the registry
        if (fqn) {
          const details = await fetchProviderDetails(fqn);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    status: "success",
                    source: "pay-skills registry",
                    provider: details,
                    note: "Use paysh_call_api with the gatewayUrl and a specific path to make a paid API call.",
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        if (!gatewayUrl) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "Please provide either a gatewayUrl or fqn to check pricing.",
              },
            ],
          };
        }

        // Send preflight request to get 402 challenge
        const pricing = await fetchEndpointPricing(
          gatewayUrl,
          method,
          path || ""
        );

        if (!pricing.is402) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    status: "free_endpoint",
                    message:
                      pricing.error ||
                      "This endpoint did not return a 402 response. It may be free or not a pay.sh-gated endpoint.",
                    gatewayUrl,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        if (pricing.error) {
          return {
            isError: true,
            content: [{ type: "text", text: pricing.error }],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "success",
                  gatewayUrl,
                  method,
                  path: path || "/",
                  pricing: {
                    priceUsd: pricing.priceUsd,
                    formattedPrice: `$${pricing.priceUsd?.toFixed(6)} USDC`,
                    recipient: pricing.recipient,
                    description: pricing.description,
                    expiresAt: pricing.expiresAt,
                    protocol: pricing.challenge?.method || "solana",
                    intent: pricing.challenge?.intent || "charge",
                  },
                  note: "Use paysh_call_api to make this paid API call. The USDC amount shown will be charged from your Privy wallet.",
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error fetching pricing: ${err?.message || err}`,
            },
          ],
        };
      }
    },
  },

  // ── paysh_call_api ─────────────────────────────────────────────────────────
  {
    definition: {
      name: "paysh_call_api",
      description:
        "Make a paid API call through a pay.sh gateway using the user's Privy wallet for USDC payment. " +
        "Handles the full HTTP 402 payment handshake: sends request, parses challenge (v1/v2), " +
        "signs USDC transfer via Privy, and retries with payment proof. " +
        "Supports all Pay.sh/x402 APIs. Use paysh_get_api_docs first to inspect endpoint paths and required request body fields. " +
        "For flight search ('https://travel.brij.fi' or 'brij/travel'), call path='/air/search' with method='POST' and " +
        "body: { origin_iata: 'LOS', destination_iata: 'LHR', depart_date: 'YYYY-MM-DD', adults: 1 }. " +
        "Maximum per-call cost: $5 USDC. Use paysh_get_pricing or dryRun=true to preview costs.",
      inputSchema: {
        type: "object",
        properties: {
          gatewayUrl: {
            type: "string",
            description: "The pay.sh gateway URL to call (e.g. 'https://travel.brij.fi' or from paysh_search_apis)",
          },
          method: {
            type: "string",
            description: "HTTP method (GET, POST, PUT, DELETE). Defaults to GET.",
          },
          path: {
            type: "string",
            description:
              "API path to append to the gateway URL (e.g. '/air/search', '/v1/translate', '/quote/AAPL')",
          },
          body: {
            type: "object",
            description:
              "Request body for POST/PUT requests (will be JSON-serialized). Ensure correct field names and formats (e.g. 3-letter IATA codes and 'YYYY-MM-DD' dates for travel APIs). Use paysh_get_api_docs to inspect expected schemas.",
          },
          headers: {
            type: "object",
            description: "Additional request headers to include",
          },
          dryRun: {
            type: "boolean",
            description:
              "If true, fetches pricing without making a payment. Useful to preview costs before committing.",
          },
          category: {
            type: "string",
            description:
              "Optional spending category for spend-to-invest attribution (e.g. 'travel', 'shopping', 'dining', 'services'). Inferred if omitted.",
          },
        },
        required: ["gatewayUrl"],
      },
      _meta: {
        securitySchemes: [{ type: "oauth2", scopes: [] }],
      },
    },
    handler: async (args, context) => {
      // 🔒 Require authentication — this tool spends real USDC
      if (!context.verifiedUser) {
        return authRequiredResult(
          "Please sign in to your Corre account to make paid API calls via pay.sh."
        );
      }

      const gatewayUrl = args?.gatewayUrl as string;
      const method = (args?.method as string) || "GET";
      const path = (args?.path as string) || "";
      const body = args?.body as object | undefined;
      const headers = args?.headers as Record<string, string> | undefined;
      const dryRun = args?.dryRun as boolean | undefined;

      if (!gatewayUrl) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "gatewayUrl is required. Use paysh_search_apis to find available APIs.",
            },
          ],
        };
      }

      // ── Dry run: just fetch pricing ────────────────────────────────────────
      if (dryRun) {
        try {
          const pricing = await fetchEndpointPricing(gatewayUrl, method, path, body);

          if (!pricing.is402) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      status: "free_endpoint",
                      message: "This endpoint does not require payment.",
                      gatewayUrl,
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    status: "dry_run",
                    message: "Pricing preview — no payment was made.",
                    gatewayUrl,
                    method,
                    path: path || "/",
                    estimatedCost: {
                      priceUsd: pricing.priceUsd,
                      formattedPrice: `$${pricing.priceUsd?.toFixed(6)} USDC`,
                      recipient: pricing.recipient,
                      description: pricing.description,
                    },
                    note: "Set dryRun to false (or omit it) to execute this paid call.",
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (err: any) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Dry run failed: ${err?.message || err}`,
              },
            ],
          };
        }
      }

      // ── Look up user's Privy wallet ────────────────────────────────────────
      const wallet = await lookupUserWallet(context.verifiedUser.privyUserId);

      if (!wallet || !wallet.walletAddress) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "wallet_not_found",
                message:
                  "No Solana wallet found for your account. Please log into the Corre app to initialize your wallet.",
                loginUrl: `${context.getAppBaseUrl()}/login`,
              }),
            },
          ],
        };
      }

      if (!wallet.walletId) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "wallet_not_delegated",
                message:
                  "Your wallet is not set up for in-chat signing. Please authorize agent signing in the Corre app.",
                authorizeUrl: `${context.getAppBaseUrl()}/settings`,
              }),
            },
          ],
        };
      }

      // ── Execute the paid API call ──────────────────────────────────────────
      try {
        const result = await executePayshRequest({
          gatewayUrl,
          method,
          path,
          body,
          headers,
          walletAddress: wallet.walletAddress,
          walletId: wallet.walletId,
        });

        if (!result.success) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    status: "payment_failed",
                    error: result.error,
                    amountUsd: result.amountPaidUsd,
                    txSignature: result.txSignature,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        // ── Emit spend-to-invest event asynchronously via Inngest ───────────
        if (result.amountPaidUsd && result.amountPaidUsd > 0) {
          const detectedCategory =
            args?.category ||
            (gatewayUrl.includes("agentres")
              ? "dining"
              : gatewayUrl.includes("flight") || gatewayUrl.includes("travel")
              ? "travel"
              : gatewayUrl.includes("shop")
              ? "shopping"
              : "services");

          inngest
            .send({
              // M3 FIX: use on-chain tx signature as dedup key — prevents double-counting
              // if the MCP tool is called again after a successful payment (LLM retry)
              id: `paysh-${result.txSignature || Date.now()}`,
              name: "spend.completed",
              data: {
                privyUserId: context.verifiedUser.privyUserId,
                spendAmountUsd: result.amountPaidUsd,
                category: detectedCategory,
                merchantName: gatewayUrl,
                txSignature: result.txSignature,
                source: "paysh",
              },
            })
            .catch((err) => {
              console.error("[Inngest] Failed to emit spend.completed event:", err);
            });
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "success",
                  apiResponse: result.responseBody,
                  payment: {
                    amountPaidUsd: result.amountPaidUsd,
                    formattedAmount: `$${result.amountPaidUsd?.toFixed(6)} USDC`,
                    recipient: result.recipientAddress,
                    txSignature: result.txSignature,
                    solscanUrl: result.solscanUrl,
                  },
                  metadata: {
                    statusCode: result.statusCode,
                    gatewayUrl,
                    method,
                    path: path || "/",
                  },
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error executing paid API call: ${err?.message || err}`,
            },
          ],
        };
      }
    },
  },
];
