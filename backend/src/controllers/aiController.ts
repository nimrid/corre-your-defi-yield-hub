import type { Request, Response } from "express";

/**
 * POST /ai/chat
 *
 * Proxies chat completion requests to the Groq API so the API key
 * stays server-side and we avoid browser CORS issues.
 */
export async function chatCompletion(req: Request, res: Response) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Groq API key not configured" });
  }

  const { messages, model, temperature, max_completion_tokens, top_p } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array is required" });
  }

  try {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || "llama-3.1-8b-instant",
        messages,
        temperature: temperature ?? 1,
        max_completion_tokens: max_completion_tokens ?? 1024,
        top_p: top_p ?? 1,
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error(`Groq API error (${groqRes.status}):`, errText);
      return res.status(groqRes.status).json({ error: "AI service unavailable" });
    }

    const data = await groqRes.json();
    return res.json(data);
  } catch (err) {
    console.error("Error proxying to Groq:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
