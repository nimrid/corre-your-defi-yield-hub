import { Router } from "express";
import { getTransactions, createTransaction } from "../controllers/transactionController.js";
import { validateBody } from "../lib/validate.js";
import { cacheResponse } from "../lib/responseCache.js";
import { CreateTransactionSchema } from "../schemas/index.js";

const router = Router();

// Cache history for 30s — data only changes when the user makes a new tx
router.get("/:privyUserId", cacheResponse(30_000), getTransactions);
router.post("/", validateBody(CreateTransactionSchema), createTransaction);

export default router;
