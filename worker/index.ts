import "dotenv/config";

import { Worker } from "bullmq";
import { connection } from "../src/lib/redis/upstash";
import { supabaseAdmin } from "../src/lib/db/supabase-admin";

const worker = new Worker(
    "SupportQueue",

    async (job) => {
        console.log("=================================");
        console.log("📨 New Job Received");
        console.log(job.data);

        const { ticketId } = job.data;

        // Fetch ticket
        const { data: ticket, error } = await supabaseAdmin
            .from("tickets")
            .select("*")
            .eq("id", ticketId)
            .single();

        if (error || !ticket) {
            console.error("Ticket not found");
            throw error;
        }

        console.log("Ticket Content:");
        console.log(ticket.content);

        console.log("🤖 Simulating AI...");

        await new Promise((resolve) => setTimeout(resolve, 5000));

        console.log("Updating ticket...");

        await supabaseAdmin
            .from("tickets")
            .update({
                status: "resolved",
            })
            .eq("id", ticketId);

        console.log("✅ Ticket resolved");
        console.log("=================================");
    },

    {
        connection,
    }
);

worker.on("ready", () => {
    console.log("🚀 Worker Ready");
});

worker.on("completed", (job) => {
    console.log(`✅ Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
    console.error(`❌ Job ${job?.id} failed`);
    console.error(err);
});