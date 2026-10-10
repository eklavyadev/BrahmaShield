import assert from "node:assert/strict";
import { cloudSnapshot } from "../lib/cloud-repository";
import { supabaseRequest } from "../lib/supabase";
async function main() {
  const state = await cloudSnapshot();
  assert.ok(Array.isArray(state.incidents));
  console.log("Supabase application schema connected.");
  const bucket = await supabaseRequest<{ public: boolean; file_size_limit: number }>(
    "/storage/v1/bucket/bs-evidence",
  );
  assert.equal(bucket.public, false);
  assert.equal(bucket.file_size_limit, 1000000);
  console.log("Evidence bucket is private with a 1 MB limit.");
  for (const path of [
    "/rest/v1/bs_state?select=id",
    "/rest/v1/bs_responder_memberships?select=user_id",
    "/rest/v1/rpc/bs_claim_job",
  ]) {
    const response = await fetch(`${process.env.SUPABASE_URL}${path}`, {
      method: path.includes("rpc") ? "POST" : "GET",
      headers: {
        apikey: process.env.SUPABASE_PUBLISHABLE_KEY!,
        "Content-Type": "application/json",
      },
      ...(path.includes("rpc") ? { body: "{}" } : {}),
    });
    assert.ok(
      response.status === 401 || response.status === 403,
      `Client access must be denied: ${path} returned ${response.status}`,
    );
  }
  console.log("Publishable key cannot access state, membership records, or AI jobs.");
  const response = await fetch("http://localhost:11434/api/tags", {
    signal: AbortSignal.timeout(4000),
  });
  const data = await response.json();
  const installed = data.models?.some(
    (model: { name: string }) => model.name === process.env.GEMMA_MODEL,
  );
  console.log(
    installed
      ? "Configured Gemma weights are installed."
      : "Ollama is running; configured Gemma weights are still downloading.",
  );
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Backend check failed");
  process.exitCode = 1;
});
