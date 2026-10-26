import { Router } from "express";
import { getTransactions, createTransaction } from "../controllers/transactionController.js";
import { getOnchainTransactions, getArcOnchainTransactions } from "../controllers/onchainTransactionController.js";
import { validateBody } from "../lib/validate.js";
import { cacheResponse } from "../lib/responseCache.js";
import { CreateTransactionSchema } from "../schemas/index.js";

const router = Router();

// On-chain USDC transfer history (Arc via Alchemy or Solana via Helius) — cache for 30s
// MUST be before the catch-all /:privyUserId route
router.get("/onchain/arc/:walletAddress", cacheResponse(30_000), (req, res) => getArcOnchainTransactions(req.params.walletAddress, res));
router.get("/onchain/:walletAddress", cacheResponse(30_000), getOnchainTransactions);

// Cache history for 30s — data only changes when the user makes a new tx
router.get("/:privyUserId", cacheResponse(30_000), getTransactions);
router.post("/", validateBody(CreateTransactionSchema), createTransaction);

export default router;
