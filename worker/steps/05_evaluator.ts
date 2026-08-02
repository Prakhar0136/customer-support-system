// worker/steps/05-evaluator.ts
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

export interface EvaluationResult {
    confidence: number;
    reasoning: string;
}

export async function evaluateDraft(
    userQuery: string,
    aiDraft: string
): Promise<EvaluationResult> {
    console.log("⚖️ [Evaluator] Scoring draft confidence...");

    const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
            {
                role: "system",
                content: `You are a strict QA manager for a customer support AI.
Evaluate the AI draft response against the user's original query.

Criteria:
1. Relevance: Does it directly and completely answer the question?
2. Accuracy & Safety: Is it grounded, helpful, and free of contradictions or hallucinations?

Output strictly JSON in this format:
{
  "confidence": <float between 0.0 and 1.0>,
  "reasoning": "<one sentence explaining the score>"
}`,
            },
            {
                role: "user",
                content: `User Query: "${userQuery}"\n\nAI Draft: "${aiDraft}"`,
            },
        ],
    });

    const rawResponse = completion.choices[0]?.message?.content ?? "";
    const cleaned = rawResponse
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

    try {
        const parsed = JSON.parse(cleaned);
        return {
            confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
            reasoning: parsed.reasoning || "No reasoning provided.",
        };
    } catch {
        console.error("⚠️ Failed to parse evaluator JSON. Defaulting confidence to 0.5");
        return {
            confidence: 0.5,
            reasoning: "Evaluation failed to parse.",
        };
    }
}