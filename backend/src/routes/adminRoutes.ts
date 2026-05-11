import { Router } from "express";
import { getDashboardStats, getUsersList } from "../controllers/adminController.js";

const router = Router();

// Add middleware to check for admin privileges if needed
router.get("/stats", getDashboardStats);
router.get("/users", getUsersList);

export default router;
