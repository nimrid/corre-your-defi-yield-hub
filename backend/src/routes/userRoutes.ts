import { Router } from "express";
import { listUsers, upsertUser, getUserReferral } from "../controllers/userController.js";
import { validateBody } from "../lib/validate.js";
import { UpsertUserSchema } from "../schemas/index.js";

const router = Router();

router.get("/", listUsers);
router.post("/upsert", validateBody(UpsertUserSchema), upsertUser);
router.get("/:privyUserId/referral", getUserReferral);

export default router;
