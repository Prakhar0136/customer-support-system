// worker/steps/03-rag.ts
import { pipeline } from "@xenova/transformers";
import Groq from "groq-sdk";
import { supabase } from "../../src/lib/db/supabase";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Singleton pattern to keep the embedding extractor warm across job runs
let extractorInstance: any = null;

async function getExtractor() {
    if (!extractorInstance) {
        console.log("🤖 Loading embedding model for RAG search...");
        extractorInstance = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    }
    return extractorInstance;
}

export async function processAgentRAGStep(ticketId: string, ticketContent: string) {
    console.log(`🔍 [RAG Step] Processing query for ticket: ${ticketId}`);

    // 1. Embed incoming customer question
    const extractor = await getExtractor();
    const output = await extractor(ticketContent, { pooling: "mean", normalize: true });
    const queryEmbedding = Array.from(output.data);

    // 2. Perform PgVector cosine similarity match in Supabase
    const { data: matchedDocs, error } = await supabase.rpc("match_knowledge_base", {
        query_embedding: queryEmbedding,
        match_threshold: 0.15, // Return docs with at least 15% similarity
        match_count: 2,         // Retrieve top 2 articles
    });

    if (error) {
        console.error("❌ PgVector search failed:", error.message);
        throw new Error(`Database RAG error: ${error.message}`);
    }

    // 3. Construct Context Block
    let contextText = "No relevant knowledge base articles found.";

    if (matchedDocs && matchedDocs.length > 0) {
        console.log(`📚 Found ${matchedDocs.length} relevant articles:`, matchedDocs.map((d: any) => d.title));
        contextText = matchedDocs
            .map((doc: any, idx: number) => `[Article ${idx + 1}: ${doc.title}]\n${doc.content}`)
            .join("\n\n");
    } else {
        console.log("⚠️ No articles matched the similarity threshold.");
    }

    // 4. Prompt Llama 3 on Groq with injected context
    const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        temperature: 0.2, // Low temperature keeps output grounded in facts
        messages: [
            {
                role: "system",
                content: `You are a professional customer support agent. 
Answer the customer's request accurately using ONLY the provided Documentation Context below. 
If the documentation does not contain enough information to answer, state politely that you will need to escalate the request to a human operator.

Documentation Context:
${contextText}`,
            },
            {
                role: "user",
                content: ticketContent,
            },
        ],
    });

    const aiDraft = completion.choices[0]?.message?.content || "Could not generate a response.";

    console.log(`✨ Generated Draft Response:\n"${aiDraft.slice(0, 100)}..."`);

    return {
        aiDraft,
        retrievedDocs: matchedDocs || [],
    };
}