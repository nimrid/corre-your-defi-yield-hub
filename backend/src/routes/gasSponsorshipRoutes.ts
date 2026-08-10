import { Router } from "express";
import rateLimit from "express-rate-limit";
import { checkGasSponsorship, getGasSponsorshipStats, sponsorTransaction } from "../controllers/gasSponsorshipController.js";
import { validateBody } from "../lib/validate.js";
import { cacheResponse } from "../lib/responseCache.js";
import { GasSponsorshipCheckSchema } from "../schemas/index.js";

const router = Router();

// This endpoint co-signs and broadcasts with the fee payer, and is mounted
// outside `/api` so the global API limiter does NOT cover it. Give it its own
// stricter per-IP limit as a defense-in-depth guard against fee-payer draining.
const sponsorLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many sponsorship requests. Please slow down." },
});

router.post("/check", validateBody(GasSponsorshipCheckSchema), checkGasSponsorship);
// Stats endpoint hits 3 DB queries per call — cache for 60s (monitoring dashboard)
router.get("/stats", cacheResponse(60_000), getGasSponsorshipStats);
router.post("/sponsor-transaction", sponsorLimiter, sponsorTransaction);

export default router;
