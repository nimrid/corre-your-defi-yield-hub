import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { ArrowLeft, Bot, Terminal, Code2, Sparkles, Globe, Copy, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const CodeBlock = ({ code, language = "json" }: { code: string; language?: string }) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative mt-2 mb-6 group">
      <div className="absolute right-2 top-2">
        <Button
          variant="secondary"
          size="sm"
          className="h-8 text-xs opacity-0 group-hover:opacity-100 transition-opacity bg-secondary/80 hover:bg-secondary gap-1"
          onClick={copyToClipboard}
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied!" : "Copy"}
        </Button>
      </div>
      <pre className="bg-secondary/30 border border-border/50 p-4 rounded-xl overflow-x-auto text-sm text-muted-foreground font-mono">
        <code>{code}</code>
      </pre>
    </div>
  );
};

const AIGuide = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navigation />
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 space-y-8 w-full">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <div className="glass-card p-6 sm:p-8 rounded-2xl space-y-6">
          <div className="border-b border-border/50 pb-6 space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
              <Globe className="w-3.5 h-3.5" /> Live Production Endpoint: https://mcp.corre.bond
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Connect AI Agents to Corre (MCP Server)</h1>
            <p className="text-sm text-muted-foreground">
              Turn ChatGPT, Claude, or Cursor into your personal AI trader. Connect directly via <code className="text-foreground font-mono bg-secondary/50 px-1 py-0.5 rounded">https://mcp.corre.bond</code> to analyze stock holdings, check vault yields, and execute transactions hands-free.
            </p>
          </div>

          <div className="space-y-10 text-sm leading-relaxed text-muted-foreground">
            
            {/* SECTION 1: ChatGPT & Connectors */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-foreground font-semibold text-lg">
                <Sparkles className="w-5 h-5 text-primary" />
                <h2>1. ChatGPT (Developer Mode & Connectors)</h2>
              </div>
              <p>
                ChatGPT supports native MCP connectors over SSE. Connect Corre's live endpoint directly:
              </p>

              <h3 className="font-semibold text-foreground text-base mt-4">Step-by-Step ChatGPT Setup</h3>
              <ol className="list-decimal pl-5 space-y-2">
                <li>In ChatGPT, navigate to <strong className="text-foreground">Settings → Security & Login</strong> and ensure <strong className="text-foreground">Developer mode</strong> is enabled.</li>
                <li>Go to the <strong className="text-foreground">Plugins / Connectors</strong> menu (via Advanced Settings or the <code className="text-foreground font-mono">+</code> icon in your chat composer).</li>
                <li>Select <strong className="text-foreground">Add MCP Server / Connector</strong>.</li>
                <li>Set the connection protocol to <strong className="text-foreground">SSE</strong> and enter our production URL:</li>
              </ol>

              <CodeBlock code="https://mcp.corre.bond" language="text" />

              <p className="text-xs bg-primary/10 text-primary px-3 py-2 rounded-lg border border-primary/20">
                ✨ Once connected, all Corre tools (e.g. <code className="font-mono">list_available_stocks</code>, <code className="font-mono">get_user_portfolio</code>, <code className="font-mono">prepare_buy_stock</code>, <code className="font-mono">get_savings_yield</code>) will automatically be available in your ChatGPT session!
              </p>
            </section>

            {/* SECTION 2: Claude Connectors & Claude Desktop */}
            <section className="space-y-4 border-t border-border/50 pt-6">
              <div className="flex items-center gap-2 text-foreground font-semibold text-lg">
                <Bot className="w-5 h-5 text-primary" />
                <h2>2. Claude (Connectors & Claude Desktop)</h2>
              </div>
              <p>
                Claude allows you to add custom Remote MCP Connectors in app settings or via your desktop configuration file.
              </p>
              
              <h3 className="font-semibold text-foreground text-base mt-4">Option A: Claude App Settings (Connectors)</h3>
              <ol className="list-decimal pl-5 space-y-2">
                <li>Open Claude and navigate to <strong className="text-foreground">Settings → Integrations / Connectors</strong>.</li>
                <li>Click <strong className="text-foreground">Add Custom MCP Connector</strong>.</li>
                <li>Enter our production SSE endpoint URL: <code className="text-foreground font-mono bg-secondary/50 px-1 py-0.5 rounded">https://mcp.corre.bond</code></li>
              </ol>

              <h3 className="font-semibold text-foreground text-base mt-4">Option B: Config File (<code className="text-foreground font-mono">claude_desktop_config.json</code>)</h3>
              <CodeBlock 
                code={`{
  "mcpServers": {
    "corre-yield-hub": {
      "url": "https://mcp.corre.bond"
    }
  }
}`}
              />
            </section>

            {/* SECTION 3: Cursor & Windsurf */}
            <section className="space-y-4 border-t border-border/50 pt-6">
              <div className="flex items-center gap-2 text-foreground font-semibold text-lg">
                <Code2 className="w-5 h-5 text-primary" />
                <h2>3. Cursor & Windsurf IDE</h2>
              </div>
              <p>
                In Cursor Settings → Features → MCP, click <strong>Add New Server</strong>:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Name:</strong> <code className="text-foreground bg-secondary/50 px-1 py-0.5 rounded font-mono">corre-yield-hub</code></li>
                <li><strong>Type:</strong> <code className="text-foreground bg-secondary/50 px-1 py-0.5 rounded font-mono">sse</code></li>
                <li><strong>URL:</strong> <code className="text-foreground bg-secondary/50 px-1 py-0.5 rounded font-mono">https://mcp.corre.bond</code></li>
              </ul>
            </section>

            {/* SECTION 4: Open-WebUI & Other Agents */}
            <section className="space-y-4 border-t border-border/50 pt-6">
              <div className="flex items-center gap-2 text-foreground font-semibold text-lg">
                <Terminal className="w-5 h-5 text-primary" />
                <h2>4. Other MCP Clients (Goose, Raycast, Open-WebUI)</h2>
              </div>
              <p>Use our production SSE endpoint URL directly:</p>
              <CodeBlock code="https://mcp.corre.bond" language="text" />
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AIGuide;
