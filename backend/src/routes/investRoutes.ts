import { Router } from "express";
import { createPrivateMarketPurchase, getPrivateMarketStats, getPrivateMarketHistory } from "../controllers/investController.js";

const router = Router();

router.post("/private-market", createPrivateMarketPurchase);
router.get("/private-market/:investmentId/stats", getPrivateMarketStats);
router.get("/private-market/history/:privyUserId", getPrivateMarketHistory);

export default router;
