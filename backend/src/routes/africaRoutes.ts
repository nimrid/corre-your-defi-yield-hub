import express, { Request, Response } from "express";
import crypto from "crypto";

const router = express.Router();

const FONBNK_BASE_URL = process.env.FONBNK_BASE_URL || "https://sandbox-api.fonbnk.com";
const FONBNK_CLIENT_ID = process.env.AfricanBank_ClientID;
const FONBNK_CLIENT_SECRET = process.env.API_signature_secret;
const FONBNK_WIDGET_SOURCE = process.env.AfricanBank_Source;
const FONBNK_WIDGET_URL_SECRET = process.env.URL_signature_secret;

let fonbnkCurrenciesFailureCount = 0;
const FONBNK_CURRENCIES_MAX_FAILURES = 6;

const signFonbnkEndpoint = (endpoint: string) => {
  if (!FONBNK_CLIENT_SECRET || !FONBNK_CLIENT_ID) {
    throw new Error(
      "Fonbnk client credentials are not configured (AfricanBank_ClientID / AfricanBank_ClientSecret)"
    );
  }

  const timestamp = Date.now().toString();
  const stringToSign = `${timestamp}:${endpoint}`;
  const key = Buffer.from(FONBNK_CLIENT_SECRET, "base64");

  const hmac = crypto.createHmac("sha256", key);
  hmac.update(stringToSign, "utf8");
  const signature = hmac.digest("base64");

  return { timestamp, signature };
};

const createWidgetJwtSignature = (): string => {
  if (!FONBNK_WIDGET_URL_SECRET) {
    throw new Error(
      "Fonbnk widget URL signature secret is not configured (URL_signature_secret)"
    );
  }

  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  const uid = crypto.randomUUID();
  const payload = {
    uid,
  };

  const toBase64Url = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  const headerB64 = toBase64Url(header);
  const payloadB64 = toBase64Url(payload);
  const signingInput = `${headerB64}.${payloadB64}`;

  const hmac = crypto.createHmac("sha256", FONBNK_WIDGET_URL_SECRET);
  hmac.update(signingInput, "utf8");
  const signature = hmac
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${signingInput}.${signature}`;
};

// Widget signature endpoint
router.get("/widget-signature", (_req: Request, res: Response) => {
  try {
    const signature =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMn0.KMUFsIDTnFmyG3nMiGM6H9FNFUROf3wh7SmqJp-QV30";

    return res.json({
      source: FONBNK_WIDGET_SOURCE || "",
      signature,
    });
  } catch (err) {
    console.error("Error returning Fonbnk widget signature", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Quote endpoint
router.post("/quote", async (req: Request, res: Response) => {
  try {
    if (!FONBNK_CLIENT_ID || !FONBNK_CLIENT_SECRET) {
      return res.status(500).json({
        error: "Fonbnk client credentials are not configured on the server",
      });
    }

    const ENDPOINT = "/api/v2/quote";
    const { timestamp, signature } = signFonbnkEndpoint(ENDPOINT);

    const response = await fetch(`${FONBNK_BASE_URL}${ENDPOINT}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": FONBNK_CLIENT_ID,
        "x-timestamp": timestamp,
        "x-signature": signature,
      },
      body: JSON.stringify(req.body ?? {}),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("Fonbnk quote request failed", response.status, response.statusText, text);
      return res.status(502).json({ error: "Failed to create quote with Fonbnk" });
    }

    const data = await response.json();
    return res.json(data);
  } catch (err) {
    console.error("Error calling Fonbnk quote endpoint", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// User KYC endpoint
router.get("/user-kyc", async (req: Request, res: Response) => {
  try {
    if (!FONBNK_CLIENT_ID || !FONBNK_CLIENT_SECRET) {
      return res.status(500).json({
        error: "Fonbnk client credentials are not configured on the server",
      });
    }

    const ENDPOINT = "/api/v2/user/kyc";
    const search = new URLSearchParams(req.query as Record<string, string>).toString();
    const endpoint = search ? `${ENDPOINT}?${search}` : ENDPOINT;

    const { timestamp, signature } = signFonbnkEndpoint(endpoint);

    const response = await fetch(`${FONBNK_BASE_URL}${endpoint}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": FONBNK_CLIENT_ID,
        "x-timestamp": timestamp,
        "x-signature": signature,
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("Fonbnk user-kyc request failed", response.status, response.statusText, text);
      return res.status(502).json({ error: "Failed to fetch user KYC state from Fonbnk" });
    }

    const data = await response.json();
    return res.json(data);
  } catch (err) {
    console.error("Error calling Fonbnk user-kyc endpoint", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Order limits endpoint
router.get("/order-limits", async (req: Request, res: Response) => {
  try {
    if (!FONBNK_CLIENT_ID || !FONBNK_CLIENT_SECRET) {
      return res.status(500).json({
        error: "Fonbnk client credentials are not configured on the server",
      });
    }

    const ENDPOINT = "/api/v2/order-limits";
    const search = new URLSearchParams(req.query as Record<string, string>).toString();
    const endpoint = search ? `${ENDPOINT}?${search}` : ENDPOINT;

    const { timestamp, signature } = signFonbnkEndpoint(endpoint);

    const response = await fetch(`${FONBNK_BASE_URL}${endpoint}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": FONBNK_CLIENT_ID,
        "x-timestamp": timestamp,
        "x-signature": signature,
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("Fonbnk order-limits request failed", response.status, response.statusText, text);
      return res.status(502).json({ error: "Failed to fetch order limits from Fonbnk" });
    }

    const data = await response.json();
    return res.json(data);
  } catch (err) {
    console.error("Error calling Fonbnk order-limits endpoint", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Currencies endpoint
router.get("/currencies", async (_req: Request, res: Response) => {
  try {
    if (!FONBNK_CLIENT_ID || !FONBNK_CLIENT_SECRET) {
      return res.status(500).json({
        error: "Fonbnk client credentials are not configured on the server",
      });
    }

    if (fonbnkCurrenciesFailureCount >= FONBNK_CURRENCIES_MAX_FAILURES) {
      return res.status(502).json({
        error: "Fonbnk currencies endpoint temporarily disabled due to repeated failures",
      });
    }

    const ENDPOINT = "/api/v2/currencies";
    const { timestamp, signature } = signFonbnkEndpoint(ENDPOINT);

    const response = await fetch(`${FONBNK_BASE_URL}${ENDPOINT}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": FONBNK_CLIENT_ID,
        "x-timestamp": timestamp,
        "x-signature": signature,
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      fonbnkCurrenciesFailureCount += 1;
      console.error(
        "Fonbnk currencies request failed",
        response.status,
        response.statusText,
        text
      );
      return res.status(502).json({ error: "Failed to fetch currencies from Fonbnk" });
    }

    fonbnkCurrenciesFailureCount = 0;
    const data = await response.json();
    return res.json(data);
  } catch (err) {
    fonbnkCurrenciesFailureCount += 1;
    console.error("Error calling Fonbnk currencies endpoint", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
