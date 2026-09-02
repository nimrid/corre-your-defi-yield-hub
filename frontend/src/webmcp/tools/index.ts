import type { WebMcpTool, WebMcpContext } from "../types";
import { savingsTools } from "./savingsTools";
import { stockTools } from "./stockTools";
import { transferTools } from "./transferTools";
import { portfolioTools } from "./portfolioTools";

export function getAllWebMcpTools(context: WebMcpContext): WebMcpTool[] {
  return [
    ...savingsTools(context),
    ...stockTools(context),
    ...transferTools(context),
    ...portfolioTools(context),
  ];
}
