import "dotenv/config";
import { Worker } from "bullmq";
import Groq from "groq-sdk";

import { processAgentWithTools } from "./steps/03_rag";
import { connection } from "../src/lib/redis/upstash";
import { supabaseAdmin } from "../src/lib/db/supabase-admin";

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY!,
});

const worker = new Worker(
    "SupportQueue",
    async (job) => {
        console.log("=================================");
        console.log(`📨 Processing: ${job.name}`);
        console.log(job.data);

        switch (job.name) {
            case "Triage": {
                console.log("🔍 Running AI Triage...");

                // Fetch ticket content
                const { data: ticket, error } = await supabaseAdmin
                    .from("tickets")
                    .select("content")
                    .eq("id", job.data.ticketId)
                    .single();

                if (error || !ticket) {
                    throw new Error("Ticket not found.");
                }

                // Call Groq with JSON Mode enabled
                const completion = await groq.chat.completions.create({
                    model: "llama-3.3-70b-versatile",
                    temperature: 0,
                    response_format: { type: "json_object" }, // <-- FORCES STRICT JSON MODE
                    messages: [
                        {
                            role: "system",
                            content: `You are a customer support triage assistant.

Return ONLY valid JSON.

Schema:
{
  "sentiment":"furious|neutral",
  "intent":"question|complaint"
}`,
                        },
                        {
                            role: "user",
                            content: ticket.content,
                        },
                    ],
                });

                const rawResponse = completion.choices[0].message.content ?? "";

                console.log("🤖 Raw AI Response:", rawResponse);

                // Strip markdown code blocks (```json ... ```) if the model added them
                const cleanedResponse = rawResponse
                    .replace(/```json/g, "")
                    .replace(/```/g, "")
                    .trim();

                let result: {
                    sentiment: "furious" | "neutral";
                    intent: "question" | "complaint";
                };

                try {
                    result = JSON.parse(cleanedResponse);
                } catch {
                    throw new Error(`AI returned invalid JSON. Raw string was: ${rawResponse}`);
                }

                console.log("Parsed Result:", result);

                // Escalate furious tickets
                if (result.sentiment === "furious") {
                    await supabaseAdmin
                        .from("tickets")
                        .update({
                            status: "escalated",
                            sentiment: result.sentiment,
                        })
                        .eq("id", job.data.ticketId);

                    console.log("🚨 Ticket Escalated");

                    throw new Error(
                        "Ticket is furious. Workflow stopped."
                    );
                }

                // Save sentiment for non-furious tickets
                await supabaseAdmin
                    .from("tickets")
                    .update({
                        sentiment: result.sentiment,
                    })
                    .eq("id", job.data.ticketId);

                console.log("✅ Triage Complete");
                break;
            }

            case "Cache": {
                console.log("📦 Cache check...");
                // Cache logic will be added here on Day 15
                await new Promise((resolve) => setTimeout(resolve, 1000));
                console.log("✅ Cache Check Complete");
                break;
            }

            case "Agent": {
                console.log("🤖 Running AI Agent...");

                // Fetch ticket content AND customer email
                const { data: ticket, error } = await supabaseAdmin
                    .from("tickets")
                    .select("id, content, customers(email)")
                    .eq("id", job.data.ticketId)
                    .single();

                if (error || !ticket) {
                    throw new Error(`Ticket not found for ID: ${job.data.ticketId}`);
                }

                const customers = ticket.customers as any;
                const customerEmail = (Array.isArray(customers) ? customers[0]?.email : customers?.email) || "unknown";

                // Run the Tool Calling Agent
                const aiDraft = await processAgentWithTools(ticket.id, ticket.content, customerEmail);

                // Save the generated draft back into Supabase
                await supabaseAdmin
                    .from("tickets")
                    .update({
                        agent_draft: aiDraft,
                        status: "needs_review",
                    })
                    .eq("id", ticket.id);

                console.log("✅ Agent Step Complete & Draft Saved");
                break;
            }

            case "Resolution": {
                console.log("📝 Resolution...");

                await new Promise((resolve) => setTimeout(resolve, 1000));

                // Optional auto-resolve logic depending on workflow state
                console.log("✅ Resolution Complete");
                break;
            }

            case "Ticket_Workflow": {
                console.log("🎉 Workflow Finished");
                break;
            }

            default:
                console.log(`Unknown Job: ${job.name}`);
        }

        console.log("=================================");
    },
    {
        connection,
    }
);

worker.on("completed", (job) => {
    console.log(`✅ Job Completed: ${job.name}`);
});

worker.on("failed", (job, err) => {
    console.log(`❌ Job Failed: ${job?.name}`);
    console.error(err.message);
});

console.log("🚀 Worker is listening for jobs...");