import { useState } from "react";
import { Bot, Send, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchStockAdvice, Message } from "@/services/aiService";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const STOCK_QUESTIONS = [
    "What is your primary investment goal? (e.g., retirement, short-term gains, buying a house)",
    "How long do you plan to hold your investments?",
    "How would you describe your risk tolerance on a scale of 1-10?",
    "Are there specific sectors you are interested in? (e.g., tech, healthcare, energy)",
];

const StockAdvisor = () => {
    const [messages, setMessages] = useState<Message[]>([
        {
            role: "assistant",
            content:
                "Hello! I am Corre AI, your personal stock advisor. To get started, you can either ask me a question directly or answer a few quick questions so I can understand your profile.",
        },
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    const handleSend = async (text: string) => {
        if (!text.trim()) return;

        const newMessages: Message[] = [...messages, { role: "user", content: text }];
        setMessages(newMessages);
        setInput("");
        setLoading(true);

        try {
            // Slicing out the first default greeting from the array so it's a valid chat flow
            const apiMessages = newMessages.slice(1);
            const assistantRawMsg = await fetchStockAdvice(apiMessages);
            setMessages((prev) => [...prev, { role: "assistant", content: assistantRawMsg }]);
        } catch (error: any) {
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: `Error: ${error.message}` },
            ]);
        } finally {
            setLoading(false);
        }
    };

    const fillQuestion = (q: string) => {
        setInput(q);
    };

    return (
        <div className="glass-card rounded-2xl border border-border/60 overflow-hidden flex flex-col shadow-xl">
            <button
                type="button"
                className="flex items-center justify-between p-4 sm:p-5 bg-secondary/20 hover:bg-secondary/40 transition-colors w-full text-left focus:outline-none"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-3">
                    <div className="bg-primary/20 p-2 rounded-xl">
                        <Bot className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-foreground">Corre AI Advisor</h3>
                        <p className="text-xs text-muted-foreground">Personalized stock insights</p>
                    </div>
                </div>
                <div>
                    {isOpen ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                </div>
            </button>

            {isOpen && (
                <div className="flex flex-col h-[500px] border-t border-border/60 relative">
                    <div className="bg-yellow-500/10 border-b border-yellow-500/20 p-3 flex gap-2 items-start shrink-0">
                        <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                        <p className="text-xs text-yellow-600/90 dark:text-yellow-400">
                            <strong>Disclaimer:</strong> Corre AI provides automated guidance and information, not personalized financial advice. Investing in stocks involves significant risk, including loss of principal. Always do your own research or consult a certified professional before investing.
                        </p>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.map((msg, i) => (
                            <div
                                key={i}
                                className={`flex flex-col max-w-[85%] ${msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start"
                                    }`}
                            >
                                <div
                                    className={`px-4 py-3 rounded-2xl text-sm ${msg.role === "user"
                                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                                        : "bg-secondary text-secondary-foreground rounded-tl-sm border border-border/50"
                                        }`}
                                >
                                    {msg.role === "assistant" ? (
                                        <div className="prose dark:prose-invert prose-sm max-w-none">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {msg.content}
                                            </ReactMarkdown>
                                        </div>
                                    ) : (
                                        <div className="whitespace-pre-wrap">{msg.content}</div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="mr-auto items-start flex">
                                <div className="px-4 py-3 rounded-2xl bg-secondary text-secondary-foreground rounded-tl-sm border border-border/50 flex space-x-1">
                                    <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" />
                                    <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce delay-75" />
                                    <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce delay-150" />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="shrink-0 p-3 bg-secondary/10 border-t border-border/60">
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                            {STOCK_QUESTIONS.map((q, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => fillQuestion(q)}
                                    className="whitespace-nowrap rounded-full border border-border/50 bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary transition-colors"
                                >
                                    {q.length > 30 ? q.slice(0, 30) + "..." : q}
                                </button>
                            ))}
                        </div>
                        <div className="relative mt-1">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSend(input);
                                }}
                                className="w-full bg-background border border-border rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                placeholder="Ask Corre AI or answer a prompt..."
                            />
                            <button
                                type="button"
                                onClick={() => handleSend(input)}
                                disabled={loading || !input.trim()}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StockAdvisor;
