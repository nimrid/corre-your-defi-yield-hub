import { Router } from "express";
import { getDashboardStats, getUsersList } from "../controllers/adminController.js";
import { cacheResponse } from "../lib/responseCache.js";

const router = Router();

// Add middleware to check for admin privileges if needed
router.get("/stats", cacheResponse(30_000), getDashboardStats);
router.get("/users", cacheResponse(30_000), getUsersList);

export default router;
