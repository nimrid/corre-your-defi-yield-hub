import { Router } from "express";
import { createPrivateMarketPurchase, getPrivateMarketStats } from "../controllers/investController.js";

const router = Router();

router.post("/private-market", createPrivateMarketPurchase);
router.get("/private-market/:investmentId/stats", getPrivateMarketStats);

export default router;
