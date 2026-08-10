import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { getDashboardStats, getUsersList } from "../controllers/adminController.js";
import { cacheResponse } from "../lib/responseCache.js";

const router = Router();

// Shared admin key. The admin dashboard sends it as `x-admin-key`.
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || "";

/**
 * Guards the admin endpoints, which expose user PII (emails, wallets) and
 * platform-wide financial stats.
 *
 *   • key configured    → require a matching x-admin-key header (fail CLOSED).
 *   • key NOT configured → allow only outside production (local dev); in
 *     production refuse all requests so PII can never be served unauthenticated.
 */
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!ADMIN_API_KEY) {
    if (process.env.NODE_ENV === "production") {
      console.error("[Admin] ADMIN_API_KEY not set — refusing admin access in production.");
      return res.status(503).json({ error: "Admin access not configured" });
    }
    console.warn("[Admin] ADMIN_API_KEY not set — allowing admin access (non-production only).");
    return next();
  }

  const provided = (req.headers["x-admin-key"] as string) || "";
  const a = Buffer.from(provided);
  const b = Buffer.from(ADMIN_API_KEY);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return next();
}

router.use(requireAdmin);

router.get("/stats", cacheResponse(30_000), getDashboardStats);
router.get("/users", cacheResponse(30_000), getUsersList);

export default router;
