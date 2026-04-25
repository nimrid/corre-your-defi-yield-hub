import { Router } from "express";
import { chatCompletion } from "../controllers/aiController.js";

const router = Router();

router.post("/chat", chatCompletion);

export default router;
