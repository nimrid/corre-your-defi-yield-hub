import { Router } from "express";
import {
  getStockHistory,
  getStockHoldings,
  createStockPurchase,
  createStockSale,
} from "../controllers/stockController.js";
import { validateBody } from "../lib/validate.js";
import { cacheResponse } from "../lib/responseCache.js";
import { StockTradeSchema } from "../schemas/index.js";

const router = Router();

// History changes only on trades; write handlers call invalidateCache()
router.get("/history/:privyUserId", cacheResponse(30_000), getStockHistory);
// Holdings are kept in a summary table — still short-cache for safety
router.get("/holdings/:privyUserId", cacheResponse(10_000), getStockHoldings);
router.post("/purchases", validateBody(StockTradeSchema), createStockPurchase);
router.post("/sales", validateBody(StockTradeSchema), createStockSale);

export default router;
