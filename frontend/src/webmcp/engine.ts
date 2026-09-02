import type { WebMcpTool, WebMcpConnectionStatus } from "./types";

declare global {
  interface Window {
    __correWebMCP?: {
      listTools: () => any[];
      invoke: (name: string, args?: Record<string, any>) => Promise<{ content: Array<{ type: string; text: string }> }>;
      getToolsMap: () => Record<string, (args?: any) => Promise<any>>;
    };
  }
}

export async function registerToolsWithBrowser(
  tools: WebMcpTool[],
  signal: AbortSignal
): Promise<WebMcpConnectionStatus> {
  // Build lookup map for fast dispatch
  const toolMap = new Map<string, WebMcpTool>(tools.map((t) => [t.name, t]));

  // In-page execution handler with standard MCP response payload
  const invokeHandler = async (name: string, args: Record<string, any> = {}) => {
    const tool = toolMap.get(name);
    if (!tool) {
      throw new Error(`Unknown Corre WebMCP tool: ${name}`);
    }
    try {
      const result = await tool.execute(args);
      return {
        content: [
          {
            type: "text",
            text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err: any) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                status: "error",
                error: err?.message || String(err),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  };

  // Expose global test bridge on window.__correWebMCP
  window.__correWebMCP = {
    listTools: () =>
      tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
        annotations: t.annotations,
      })),
    invoke: invokeHandler,
    getToolsMap: () => {
      const map: Record<string, (args?: any) => Promise<any>> = {};
      tools.forEach((t) => {
        map[t.name] = (args = {}) => t.execute(args);
      });
      return map;
    },
  };

  // Check for native browser Model Context support
  const doc = document as any;
  const nav = navigator as any;
  const modelContext = doc.modelContext ?? nav.modelContext;

  if (modelContext?.registerTool) {
    try {
      await Promise.all(
        tools.map((tool) =>
          Promise.resolve(
            modelContext.registerTool(
              {
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema,
                annotations: tool.annotations,
                execute: async (args: Record<string, any> = {}) => {
                  try {
                    const res = await tool.execute(args);
                    return res;
                  } catch (err: any) {
                    console.error(`[WebMCP] Tool '${tool.name}' execution error:`, err);
                    return {
                      status: "error",
                      error: err?.message || String(err),
                    };
                  }
                },
              },
              { signal }
            )
          )
        )
      );
      console.log(`[WebMCP] Successfully registered ${tools.length} native browser tools.`);
      return "connected";
    } catch (err) {
      console.warn("[WebMCP] Native tool registration warning, fallback bridge active:", err);
      return "fallback";
    }
  }

  return "fallback";
}
