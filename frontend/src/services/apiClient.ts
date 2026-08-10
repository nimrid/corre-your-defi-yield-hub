/**
 * apiClient.ts
 *
 * HOW ROUTING WORKS:
 *
 *  LOCAL DEV (Vite dev server running):
 *    - All apiFetch("/transactions") calls go to "/api/transactions"
 *    - Vite proxy rewrites "/api/*" → "http://localhost:4000/*"  (strips /api prefix)
 *    - So the backend at :4000 receives /transactions — correct ✓
 *
 *  PRODUCTION (static build hosted on Render / CDN):
 *    - No Vite proxy exists in production; the app is just static HTML/JS
 *    - VITE_BACKEND_URL is baked in at build time to the backend origin
 *      e.g. "https://defi-corre.onrender.com"
 *    - apiFetch("/transactions") calls "https://defi-corre.onrender.com/transactions"
 *    - The backend receives /transactions — correct ✓
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL as string | undefined;

/**
 * Returns a full URL for the given API path.
 *
 * - In dev (VITE_BACKEND_URL is localhost or absent): use the Vite proxy via /api prefix.
 * - In production (VITE_BACKEND_URL is a real https:// URL): call the backend directly,
 *   with NO /api prefix because the backend routes are registered at root level.
 */
export const apiUrl = (path: string): string => {
  const normalised = path.startsWith("/") ? path : `/${path}`;

  // Production: absolute URL to the backend origin (no /api prefix needed)
  if (BACKEND_URL && !BACKEND_URL.includes("localhost")) {
    return `${BACKEND_URL.replace(/\/$/, "")}${normalised}`;
  }

  // Development: Vite proxy rewrites /api/* → backend/* (strips the /api prefix)
  return `/api${normalised}`;
};

export const apiFetch = async (
  path: string,
  init?: RequestInit,
): Promise<Response> => {
  const response = await fetch(apiUrl(path), init);

  // Dispatch custom event on 401 so session monitor can trigger reconnect modal
  if (response.status === 401) {
    window.dispatchEvent(
      new CustomEvent("api:unauthorized", { detail: { status: 401 } }),
    );
  }

  return response;
};

/**
 * Builds a fully-qualified URL for a PAJ Ramp webhook path.
 * PAJ calls these URLs from their servers, so they must always be absolute
 * and point directly to the *backend* (not the frontend CDN origin).
 *
 * e.g. webhookUrl("/webhooks/paj-offramp")
 *   → "https://defi-corre.onrender.com/api/webhooks/paj-offramp"  (production)
 *   → "http://localhost:4000/api/webhooks/paj-offramp"             (dev)
 */
export const webhookUrl = (path: string): string => {
  const normalised = path.startsWith("/") ? path : `/${path}`;
  const backendOrigin = (BACKEND_URL ?? "http://localhost:4000").replace(/\/$/, "");
  
  // If the path already has a prefix like /api or /webhook, don't force another /api
  if (normalised.startsWith("/api") || normalised.startsWith("/webhook")) {
    return `${backendOrigin}${normalised}`;
  }
  
  return `${backendOrigin}/api${normalised}`;
};
