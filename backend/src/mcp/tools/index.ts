import type { MCPTool } from "../types.js";
import { userTools } from "./userTools.js";
import { stockTools } from "./stockTools.js";
import { rampTools } from "./rampTools.js";
import { savingsTools } from "./savingsTools.js";
import { automationTools } from "./automationTools.js";

export const allTools: MCPTool[] = [
  ...userTools,
  ...stockTools,
  ...rampTools,
  ...savingsTools,
  ...automationTools,
];
