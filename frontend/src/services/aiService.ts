import { US_STOCK_TOKENS } from "@/config/usStockTokens";

export interface Message {
    role: "user" | "assistant" | "system";
    content: string;
}

const SYSTEM_PROMPT = `You are Corre AI, a helpful and professional stock market advisor. Keep responses formatted with markdown, clear, and concise. IMPORTANT: Users can only invest in the following tokenized stocks on our platform. Whenever suggesting stocks, ONLY mention ones clearly available in this list to ensure actionable advice on our platform:\n${US_STOCK_TOKENS.map(
    (t) => `- ${t.name} (Ticker: ${t.symbol})`
).join("\n")}`;

export const fetchStockAdvice = async (chatMessages: Message[]): Promise<string> => {
    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!apiKey) {
        throw new Error("Corre AI is not configured. Please contact support.");
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: "llama-3.1-8b-instant",
            messages: [
                {
                    role: "system",
                    content: SYSTEM_PROMPT,
                },
                ...chatMessages,
            ],
            temperature: 1,
            max_completion_tokens: 1024,
            top_p: 1,
        }),
    });

    if (!response.ok) {
        throw new Error("Corre AI is unavailable. Please try again later.");
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "I couldn't process that.";
};
