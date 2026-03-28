import { Router } from "express";
import { getPajSession, upsertPajSession } from "../controllers/pajSessionController.js";
import { validateBody } from "../lib/validate.js";
import { UpsertPajSessionSchema } from "../schemas/index.js";

const router = Router();

router.get("/:privyUserId", getPajSession);
router.put("/:privyUserId", validateBody(UpsertPajSessionSchema), upsertPajSession);

export default router;
