import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

// For routes that call Groq (cost money per request)
export const strictRatelimit = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(10, "1 m"),
	prefix: "ratelimit:strict",
});

// For routes that just proxy/parse (cheaper, but still worth capping)
export const looseRatelimit = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(30, "1 m"),
	prefix: "ratelimit:loose",
});
