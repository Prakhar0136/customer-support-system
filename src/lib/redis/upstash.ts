import IORedis from "ioredis";

export const connection = new IORedis(process.env.REDIS_URL!, {
    tls: {},
    maxRetriesPerRequest: null,
});

connection.on("ready", () => {
    console.log("✅ Connected to Upstash Redis");
});

connection.on("error", (err) => {
    console.error("Redis Error:", err);
});