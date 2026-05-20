import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { registerAllWorkers } from "./lib/queue/workers";
import { startScheduler } from "./lib/queue/scheduler";

console.log("[Worker] Starting BullMQ workers...");
console.log(`[Worker] REDIS_URL: ${process.env.REDIS_URL ?? "redis://localhost:6379"}`);

registerAllWorkers();

if (process.env.SCHEDULER_ENABLED !== "false") {
  startScheduler();
  console.log("[Worker] Scheduler started with 8 cron jobs");
} else {
  console.log("[Worker] Scheduler disabled (SCHEDULER_ENABLED=false)");
}

process.on("SIGTERM", () => {
  console.log("[Worker] SIGTERM received, shutting down...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("[Worker] SIGINT received, shutting down...");
  process.exit(0);
});

console.log("[Worker] All systems ready. Listening for jobs...");