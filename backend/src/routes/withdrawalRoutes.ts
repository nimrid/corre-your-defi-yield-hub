import { Router } from "express";
import {
  getPendingWithdrawals,
  createPendingWithdrawal,
  completePendingWithdrawal,
} from "../controllers/withdrawalController.js";
import { validateBody, validateQuery } from "../lib/validate.js";
import {
  CreateWithdrawalSchema,
  CompleteWithdrawalSchema,
  PendingWithdrawalsQuerySchema,
} from "../schemas/index.js";

const router = Router();

router.get("/pending", validateQuery(PendingWithdrawalsQuerySchema), getPendingWithdrawals);
router.post("/pending", validateBody(CreateWithdrawalSchema), createPendingWithdrawal);
router.post("/complete", validateBody(CompleteWithdrawalSchema), completePendingWithdrawal);

export default router;
