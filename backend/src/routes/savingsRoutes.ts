import { Router } from "express";
import { getSavingsActivity, createSavingsActivity } from "../controllers/transactionController.js";
import { validateBody } from "../lib/validate.js";
import { cacheResponse } from "../lib/responseCache.js";
import { CreateSavingsSchema } from "../schemas/index.js";

const router = Router();

router.get("/:privyUserId", cacheResponse(30_000), getSavingsActivity);
router.post("/", validateBody(CreateSavingsSchema), createSavingsActivity);

export default router;
