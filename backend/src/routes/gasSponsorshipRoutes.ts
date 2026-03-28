import { Router } from "express";
import { checkGasSponsorship, getGasSponsorshipStats } from "../controllers/gasSponsorshipController.js";
import { validateBody } from "../lib/validate.js";
import { cacheResponse } from "../lib/responseCache.js";
import { GasSponsorshipCheckSchema } from "../schemas/index.js";

const router = Router();

router.post("/check", validateBody(GasSponsorshipCheckSchema), checkGasSponsorship);
// Stats endpoint hits 3 DB queries per call — cache for 60s (monitoring dashboard)
router.get("/stats", cacheResponse(60_000), getGasSponsorshipStats);

export default router;
