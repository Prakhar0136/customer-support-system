import { FlowProducer, Queue } from "bullmq";
import { connection } from "../redis/upstash";

export const supportQueue = new Queue("SupportQueue", {
    connection,
});

export const supportFlowProducer = new FlowProducer({
    connection,
});