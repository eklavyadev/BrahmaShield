import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { actionSchema, reportSchema } from "../lib/domain";
import { claimJob, finishJob, snapshot, submitReport, updateIncident } from "../lib/repository";
import { interpret, preparednessAnswer } from "../lib/ai";

process.env.DATA_DIRECTORY = mkdtempSync(path.join(tmpdir(), "brahmashield-test-"));
process.env.AI_MODE = "demo";
const payload = reportSchema.parse({
  clientId: crypto.randomUUID(),
  hazard: "flood",
  description: "নাওবৈচাৰ পথত পানী উঠিছে। কেইজনমান লোক পথৰ সিপাৰে আবদ্ধ হৈ আছে।",
  district: "Lakhimpur",
  locationName: "Naoboicha road",
  lat: 27.16,
  lng: 94.09,
  observedAt: new Date().toISOString(),
  language: "as",
  declaration: true,
});
test("durable repository preserves submissions and retries do not create duplicate incidents", () => {
  const initialCount = snapshot().incidents.length;
  const first = submitReport(payload);
  const retry = submitReport(payload);
  assert.equal(first.duplicate, false);
  assert.equal(retry.duplicate, true);
  assert.equal(first.incident.id, retry.incident.id);
  assert.equal(snapshot().incidents.length, initialCount + 1);
  assert.equal(first.incident.demo, false);
  assert.equal(first.incident.verification, "unverified");
  assert.equal(first.incident.reports[0].analysisState, "pending");
});
test("jobs survive independently of responses and completed analysis never verifies a report", async () => {
  const job = claimJob();
  assert.ok(job);
  assert.equal(claimJob(), undefined);
  const analysis = await interpret({ description: payload.description, language: "as" });
  finishJob(job.id, job.incident_id, job.report_id, analysis);
  const incident = snapshot().incidents.find((item) => item.id === job.incident_id)!;
  assert.equal(incident.verification, "unverified");
  assert.equal(incident.reports[0].analysisState, "complete");
  assert.equal(incident.reports[0].analysis?.mode, "demo");
  assert.equal(incident.reports[0].description, payload.description);
  assert.equal(incident.reports[0].analysis?.hazard, "flood");
});
test("invalid image content is rejected without saving an incident", () => {
  const before = snapshot().incidents.length;
  assert.throws(
    () =>
      submitReport({
        ...payload,
        clientId: crypto.randomUUID(),
        imageData: "data:image/png;base64,bm90YW5pbWFnZQ==",
      }),
    /file type/,
  );
  assert.equal(snapshot().incidents.length, before);
});
test("saved transitions and audit events are visible in subsequent snapshots", () => {
  const incident = snapshot().incidents.find((item) => !item.demo)!;
  updateIncident(
    incident.id,
    actionSchema.parse({
      revision: incident.revision,
      action: "verify",
      note: "Field volunteer confirmed this observation directly.",
    }),
  );
  const saved = snapshot().incidents.find((item) => item.id === incident.id)!;
  assert.equal(saved.verification, "verified");
  assert.equal(saved.history.at(-1)?.actor, "Responder");
});
test("AI failure leaves original report intact and supports a durable retry", () => {
  const submitted = submitReport({
    ...payload,
    description: payload.description + " A separate fresh observation.",
    clientId: crypto.randomUUID(),
  });
  const job = claimJob();
  assert.ok(job);
  finishJob(job.id, job.incident_id, job.report_id);
  const failed = snapshot().incidents.find((item) => item.id === submitted.incident.id)!;
  assert.equal(failed.reports[0].analysisState, "failed");
  assert.equal(failed.reports[0].description, submitted.incident.reports[0].description);
  updateIncident(failed.id, actionSchema.parse({ revision: failed.revision, action: "retry_ai" }));
  assert.equal(claimJob()?.incident_id, failed.id);
});
test("demo interpretation does not pretend to translate arbitrary Assamese", async () => {
  const output = await interpret({
    description: "অন্য এটা খবৰ যাৰ কোনো পৰীক্ষিত অনুবাদ নাই।",
    language: "as",
  });
  assert.equal(output.mode, "demo");
  assert.equal(output.hazard, "unknown");
  assert.deepEqual(output.locationClues, []);
  assert.match(output.language, /not interpreted/);
});
test("preparedness answers provide sources and unsupported questions abstain", async () => {
  const supported = await preparednessAnswer("How do I prepare for a flood?", "en");
  assert.ok(supported.sources.length);
  assert.equal(supported.mode, "demo");
  const unsupported = await preparednessAnswer("Is this bridge safe to cross right now?", "en");
  assert.equal(unsupported.sources.length, 0);
  assert.match(unsupported.answer, /do not have approved guidance/);
});
test("suspected duplicates are saved separately and AI waits for operator review", () => {
  const held = submitReport({ ...payload, clientId: crypto.randomUUID() });
  assert.equal(held.incident.reports[0].quality?.disposition, "needs_triage");
  assert.equal(held.incident.reports[0].analysisState, "held");
  assert.equal(claimJob(), undefined);
  updateIncident(held.incident.id, actionSchema.parse({ revision: 0, action: "review" }));
  assert.equal(
    snapshot().incidents.find((item) => item.id === held.incident.id)?.reports[0].analysisState,
    "pending",
  );
  assert.equal(claimJob()?.incident_id, held.incident.id);
});
test("authority verification releases a held AI job and retains the authority actor", () => {
  const held = submitReport({ ...payload, clientId: crypto.randomUUID() });
  assert.equal(held.incident.reports[0].analysisState, "held");
  const updated = updateIncident(
    held.incident.id,
    actionSchema.parse({
      revision: held.incident.revision,
      action: "override",
      priority: "high",
      verification: "verified",
      response: "new",
      note: "Authority checked the original evidence with local responders.",
    }),
    "prototype-authority",
  );
  assert.equal(updated.history.at(-1)?.actor, "prototype-authority");
  assert.equal(updated.reports[0].analysisState, "pending");
  assert.equal(claimJob()?.incident_id, held.incident.id);
});
