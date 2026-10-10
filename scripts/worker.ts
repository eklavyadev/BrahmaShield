import { processJobs } from "../lib/ai";
let stopped = false;
process.on("SIGINT", () => {
  stopped = true;
});
process.on("SIGTERM", () => {
  stopped = true;
});
async function main() {
  console.log("BrahmaShield AI worker started; no report contents are logged.");
  while (!stopped) {
    try {
      await processJobs();
    } catch {
      console.error(
        "Worker could not access its queue. Check backend configuration; leases recover automatically.",
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}
void main();
