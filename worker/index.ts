import "dotenv/config";

import { Worker } from "bullmq";
import { connection } from "../src/lib/redis/upstash";
import { supabaseAdmin } from "../src/lib/db/supabase-admin";

const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

const worker = new Worker(
    "SupportQueue",
    async (job) => {
        console.log("=================================");
        console.log(`📨 Processing: ${job.name}`);
        console.log(job.data);

        switch (job.name) {
            case "Triage":
                console.log("🔍 Triage...");
                await sleep(2000);
                console.log("✅ Triage Complete");
                break;

            case "Cache":
                console.log("📦 Cache...");
                await sleep(2000);
                console.log("✅ Cache Complete");
                break;

            case "Agent":
                console.log("🤖 Agent...");
                await sleep(2000);
                console.log("✅ Agent Complete");
                break;

            case "Resolution":
                console.log("📝 Resolution...");
                await sleep(2000);

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
    { connection }
);