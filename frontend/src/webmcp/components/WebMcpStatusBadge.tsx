import React, { useState } from "react";
import { useWebMcp } from "../useWebMcp";
import { Sparkles, Terminal, Check, Copy, ExternalLink, X, Shield, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export const WebMcpStatusBadge: React.FC = () => {
  const { status, toolsCount, tools } = useWebMcp();
  const [isOpen, setIsOpen] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [executingTool, setExecutingTool] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ tool: string; data: any } | null>(null);

  const handleCopyCode = async (code: string, index: number) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1800);
    } catch {
      // Fallback
    }
  };

  const handleExecuteInModal = async (toolName: string) => {
    try {
      setExecutingTool(toolName);
      const bridge = (window as any).__correWebMCP;
      if (!bridge) throw new Error("WebMCP bridge not mounted");
      const res = await bridge.invoke(toolName, {});
      setLastResult({ tool: toolName, data: JSON.parse(res.content[0].text) });
    } catch (err: any) {
      setLastResult({ tool: toolName, data: { error: err?.message || String(err) } });
    } finally {
      setExecutingTool(null);
    }
  };

  return (
    <>
      {/* Sleek Header Pill Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="group flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/70 bg-card/60 hover:bg-muted/80 backdrop-blur-md text-xs font-medium text-foreground transition-all duration-200 shadow-sm hover:border-primary/40 cursor-pointer"
        title="WebMCP Agent Tools"
      >
        <span className="relative flex h-2 w-2">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              status === "connected" ? "bg-emerald-400" : "bg-primary/80"
            }`}
          />
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${
              status === "connected" ? "bg-emerald-500" : "bg-primary"
            }`}
          />
        </span>
        <span className="font-semibold tracking-tight text-foreground/90">WebMCP</span>
        <span className="text-[11px] text-muted-foreground group-hover:text-foreground/80 font-normal">
          {toolsCount} tools
        </span>
      </button>

      {/* Inspector Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] p-0 flex flex-col overflow-hidden gap-0 rounded-2xl border-border bg-card shadow-2xl">
          {/* Modal Header */}
          <DialogHeader className="flex flex-row items-center justify-between px-6 py-4 border-b border-border/70 bg-muted/30 shrink-0 space-y-0 text-left pr-12">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  WebMCP Agent Inspector
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Native browser model context tools active in this page
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Status Banner */}
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/80 bg-muted/40 text-xs">
              <div className="flex items-center gap-2.5">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    status === "connected" ? "bg-emerald-500" : "bg-primary"
                  }`}
                />
                <span className="font-medium text-foreground">
                  {status === "connected"
                    ? "Native browser WebMCP connected (document.modelContext)"
                    : "Agent bridge ready • window.__correWebMCP mounted"}
                </span>
              </div>
              <span className="text-muted-foreground font-mono text-[11px]">
                {toolsCount} active tools
              </span>
            </div>

            {/* Tools List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Registered Tools
                </h4>
                <span className="text-[11px] text-muted-foreground">
                  Discoverable by AI browser agents
                </span>
              </div>

              <div className="space-y-2.5">
                {tools.map((tool, idx) => (
                  <div
                    key={tool.name}
                    className="group p-3.5 rounded-xl border border-border/60 bg-background/60 hover:bg-muted/30 transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-bold text-primary font-mono bg-primary/10 px-2 py-0.5 rounded">
                          {tool.name}
                        </code>
                        {tool.annotations?.readOnlyHint && (
                          <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            read-only
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyCode(`await window.__correWebMCP.invoke("${tool.name}");`, idx)
                          }
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-muted/60 transition cursor-pointer"
                          title="Copy console invocation snippet"
                        >
                          {copiedIndex === idx ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-500" />
                              <span className="text-emerald-500">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              <span>Copy JS</span>
                            </>
                          )}
                        </button>

                        {tool.name.startsWith("get_") || tool.name.startsWith("list_") ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-2.5"
                            disabled={executingTool === tool.name}
                            onClick={() => handleExecuteInModal(tool.name)}
                          >
                            {executingTool === tool.name ? "Running..." : "Test Run"}
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {tool.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Output Card if tested */}
            {lastResult && (
              <div className="p-4 rounded-xl border border-border/80 bg-slate-950 text-slate-100 font-mono text-xs space-y-2">
                <div className="flex items-center justify-between text-muted-foreground border-b border-slate-800 pb-2">
                  <span className="flex items-center gap-1.5">
                    <Terminal className="h-3.5 w-3.5 text-primary" />
                    <span>Result for {lastResult.tool}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setLastResult(null)}
                    className="text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
                <pre className="max-h-48 overflow-y-auto text-[11px] leading-relaxed text-emerald-400">
                  {JSON.stringify(lastResult.data, null, 2)}
                </pre>
              </div>
            )}

            {/* Dev Quick Guide */}
            <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <Terminal className="h-4 w-4 text-primary" />
                <span>Test in Browser Console</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Open your DevTools console (<code className="text-primary font-mono">Cmd + Option + J</code>) and run:
              </p>
              <div className="p-2.5 rounded-lg bg-background border border-border font-mono text-xs text-foreground flex items-center justify-between">
                <code className="break-all">await window.__correWebMCP.invoke("get_savings_yield");</code>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyCode('await window.__correWebMCP.invoke("get_savings_yield");', 999)
                  }
                  className="p-1 text-muted-foreground hover:text-foreground shrink-0 ml-2 cursor-pointer"
                >
                  {copiedIndex === 999 ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-between px-6 py-3.5 border-t border-border/70 bg-muted/20 text-xs text-muted-foreground shrink-0">
            <span className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-primary" />
              <span>Zero backend disruption • Privy protected</span>
            </span>
            <Button size="sm" variant="secondary" onClick={() => setIsOpen(false)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
