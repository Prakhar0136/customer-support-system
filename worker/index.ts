import "dotenv/config";

import { Worker } from "bullmq";
import Groq from "groq-sdk";

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

                // Call Groq
                const completion = await groq.chat.completions.create({
                    model: "llama-3.3-70b-versatile",
                    temperature: 0,
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

                const response =
                    completion.choices[0].message.content ?? "";

                console.log("🤖 AI Response:");
                console.log(response);

                let result: {
                    sentiment: "furious" | "neutral";
                    intent: "question" | "complaint";
                };

                try {
                    result = JSON.parse(response);
                } catch {
                    throw new Error("AI returned invalid JSON.");
                }

                console.log("Parsed Result:", result);

                // Escalate furious tickets
                if (result.sentiment === "furious") {
                    await supabaseAdmin
                        .from("tickets")
                        .update({
                            status: "escalated",
                        })
                        .eq("id", job.data.ticketId);

                    console.log("🚨 Ticket Escalated");

                    throw new Error(
                        "Ticket is furious. Workflow stopped."
                    );
                }

                console.log("✅ Triage Complete");
                break;
            }

            case "Cache":
                console.log("📦 Cache...");
                await new Promise((resolve) => setTimeout(resolve, 2000));
                console.log("✅ Cache Complete");
                break;

            case "Agent":
                console.log("🤖 Agent...");
                await new Promise((resolve) => setTimeout(resolve, 2000));
                console.log("✅ Agent Complete");
                break;

            case "Resolution":
                console.log("📝 Resolution...");

                await new Promise((resolve) => setTimeout(resolve, 2000));

                await supabaseAdmin
                    .from("tickets")
                    .update({
                        status: "resolved",
                    })
                    .eq("id", job.data.ticketId);

                console.log("✅ Resolution Complete");
                break;

            case "Ticket_Workflow":
                console.log("🎉 Workflow Finished");
                break;

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