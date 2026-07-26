import { Queue } from "bullmq";
import { connection } from "../redis/upstash";

export const supportQueue = new Queue("SupportQueue", {
    connection,
});