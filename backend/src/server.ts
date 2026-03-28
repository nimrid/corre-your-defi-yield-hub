import express from "express";
import cors from "cors";
import compression from "compression";
import dotenv from "dotenv";

// Route modules
import userRoutes from "./routes/userRoutes.js";
import transactionRoutes from "./routes/transactionRoutes.js";
import savingsRoutes from "./routes/savingsRoutes.js";
import stockRoutes from "./routes/stockRoutes.js";
import withdrawalRoutes from "./routes/withdrawalRoutes.js";
import gasSponsorshipRoutes from "./routes/gasSponsorshipRoutes.js";
import pajSessionRoutes from "./routes/pajSessionRoutes.js";
import africaRoutes from "./routes/africaRoutes.js";
import heliusWebhookRoutes from "./routes/heliusWebhook.js";
import privyWebhookRoutes from "./routes/privyWebhook.js";
import pajWebhookRoutes from "./routes/pajWebhook.js";

// Schema bootstrap
import { runMigrations } from "./migrations.js";

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
  // Production
  "https://defi-corre.onrender.com",
  "https://corre.bond",
  "https://www.corre.bond",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
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
      // Svix webhook verification headers
      "svix-id",
      "svix-timestamp",
      "svix-signature",
      // ngrok browser warning bypass
      "ngrok-skip-browser-warning",
    ],
  })
);

// Handle all pre-flight requests
app.options("*", cors());

// ── Compression (must be first — compresses all subsequent responses) ─────────
// Automatically gzip/deflates responses >1KB, saving 60-80% bandwidth on JSON.
app.use(compression());

// ── Webhook routes (must be mounted BEFORE express.json()) ───────────────────
// The Privy webhook uses express.raw() internally to capture the raw body for
// Svix signature verification — express.json() must NOT have run first.
app.use("/api/webhooks", privyWebhookRoutes);

// ── Global body parser ───────────────────────────────────────────────────────
app.use(express.json());

// ── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// ── Application routes ───────────────────────────────────────────────────────
app.use("/users", userRoutes);
app.use("/transactions", transactionRoutes);
app.use("/savings-activity", savingsRoutes);
app.use("/stocks", stockRoutes);
app.use("/withdrawals", withdrawalRoutes);
app.use("/gas-sponsorship", gasSponsorshipRoutes);
app.use("/paj-session", pajSessionRoutes);

// ── Third-party integration routes ───────────────────────────────────────────
app.use("/fonbnk/africa", africaRoutes);
app.use("/api/webhooks", heliusWebhookRoutes);
app.use("/webhook/paj-ramp", pajWebhookRoutes);

// ── Backward-compatible route aliases ────────────────────────────────────────
// These preserve the original URL paths so the frontend doesn't need changes.
import { getStockHistory, getStockHoldings, createStockPurchase, createStockSale } from "./controllers/stockController.js";
app.get("/stock-history/:privyUserId", getStockHistory);
app.get("/stock-holdings/:privyUserId", getStockHoldings);
app.post("/stock-purchases", createStockPurchase);
app.post("/stock-sales", createStockSale);

// ── Bootstrap ────────────────────────────────────────────────────────────────
runMigrations().catch((err) => {
  console.error("[migrations] Fatal error during schema bootstrap:", err);
  process.exit(1);
});

app.listen(port, () => {
  console.log(`Backend server listening on port ${port}`);
});
