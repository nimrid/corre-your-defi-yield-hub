import { useState } from "react";
import { Bot, Sparkles, Copy, Check, ExternalLink, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const MCPAgentBanner = () => {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const mcpProductionUrl = "https://mcp.corre.bond";
  
  const claudeSseConfig = `{
  "mcpServers": {
    "corre-yield-hub": {
      "url": "https://mcp.corre.bond"
    }
  }
}`;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-purple-500/10 to-blue-500/10 p-5 sm:p-6 shadow-xl backdrop-blur-md transition-all duration-300 hover:border-primary/50">
        {/* Background glow orb */}
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-purple-500/20 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2 max-w-xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/20 px-2.5 py-0.5 text-xs font-semibold text-primary border border-primary/30">
                <Sparkles className="w-3 h-3" /> Live MCP Protocol
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary/80 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                <Globe className="w-3 h-3 text-emerald-400" /> mcp.corre.bond
              </span>
            </div>

            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary shrink-0" />
              Manage & Trade Stocks via ChatGPT & Claude
            </h2>

            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Turn ChatGPT, Claude, or Cursor into your personal AI trader. Connect directly via <code className="text-foreground font-mono bg-secondary/50 px-1 py-0.5 rounded">https://mcp.corre.bond</code> to analyze stock holdings, check vault yields, and execute transactions hands-free.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0 sm:flex-col sm:items-end">
            <Button
              type="button"
              size="sm"
              onClick={() => setModalOpen(true)}
              className="rounded-full bg-primary text-primary-foreground font-semibold shadow-md hover:shadow-primary/25 transition-all text-xs sm:text-sm gap-1.5"
            >
              <Sparkles className="w-4 h-4" />
              Connect AI Assistant
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate("/ai-guide")}
              className="rounded-full text-xs gap-1 border-border/60 hover:bg-secondary"
            >
              Setup Guide <ExternalLink className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Connect Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Bot className="w-5 h-5 text-primary" />
              Connect Live MCP Endpoint
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Use Corre's production endpoint to connect ChatGPT, Claude, or Cursor to your portfolio.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="chatgpt" className="w-full py-2">
            <TabsList className="grid grid-cols-2 w-full rounded-full bg-muted/80 p-1">
              <TabsTrigger value="chatgpt" className="rounded-full text-xs font-semibold">ChatGPT Connectors</TabsTrigger>
              <TabsTrigger value="claude" className="rounded-full text-xs font-semibold">Claude Connectors / Cursor</TabsTrigger>
            </TabsList>

            {/* CHATGPT CONNECTOR */}
            <TabsContent value="chatgpt" className="space-y-3 pt-3">
              <p className="text-xs text-muted-foreground">
                In ChatGPT Settings or Developer Connectors, enter your live production MCP server URL:
              </p>

              <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-border/60 bg-secondary/50 font-mono text-xs text-foreground">
                <span className="truncate">{mcpProductionUrl}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(mcpProductionUrl, "url")}
                  className="h-7 text-xs gap-1 text-primary hover:text-primary shrink-0"
                >
                  {copiedKey === "url" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copiedKey === "url" ? "Copied" : "Copy URL"}
                </Button>
              </div>

              <div className="rounded-xl bg-primary/10 border border-primary/20 p-3 text-xs text-muted-foreground space-y-1.5">
                <p className="font-semibold text-foreground">ChatGPT Connection Steps:</p>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>Go to <strong>ChatGPT Settings → Security & Login → Enable Developer Mode</strong> (or Connectors).</li>
                  <li>Click <strong>Add MCP Server / Connector</strong>.</li>
                  <li>Set Protocol to <strong>SSE</strong> and paste <code className="text-foreground font-mono">https://mcp.corre.bond</code>.</li>
                  <li>Save and start prompting ChatGPT directly!</li>
                </ol>
              </div>
            </TabsContent>

            {/* CLAUDE CONNECTORS / CURSOR */}
            <TabsContent value="claude" className="space-y-3 pt-3">
              <div className="rounded-xl bg-primary/10 border border-primary/20 p-3 text-xs text-muted-foreground space-y-1.5">
                <p className="font-semibold text-foreground">Claude Connectors Setup:</p>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>In Claude, go to <strong>Settings → Integrations / Connectors</strong>.</li>
                  <li>Click <strong>Add Custom MCP Connector</strong> and paste <code className="text-foreground font-mono">https://mcp.corre.bond</code>.</li>
                </ol>
              </div>

              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                  <span>Or Config File (<code className="text-xs font-mono">claude_desktop_config.json</code>)</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(claudeSseConfig, "sse")}
                    className="h-7 text-xs gap-1 text-primary hover:text-primary"
                  >
                    {copiedKey === "sse" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedKey === "sse" ? "Copied" : "Copy JSON"}
                  </Button>
                </div>

                <pre className="rounded-xl border border-border/60 bg-secondary/50 p-3 font-mono text-xs text-foreground overflow-x-auto">
                  <code>{claudeSseConfig}</code>
                </pre>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full text-xs"
              onClick={() => {
                setModalOpen(false);
                navigate("/ai-guide");
              }}
            >
              Full Setup Guide
            </Button>
            <Button
              size="sm"
              className="rounded-full text-xs"
              onClick={() => setModalOpen(false)}
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MCPAgentBanner;
