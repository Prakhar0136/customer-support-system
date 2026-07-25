import "dotenv/config";
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL!, {
    tls: {},
    maxRetriesPerRequest: null,
});

redis.on("ready", () => {
    console.log("🚀 Worker connected to Redis");
});

redis.on("error", (err) => {
    console.error(err);
});