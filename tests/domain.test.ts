import { test } from "node:test";
import assert from "node:assert/strict";
import { actionSchema, analysisSchema, applyAction, reportSchema } from "../lib/domain";
import { createSeed } from "../lib/seed";

const base = () =>
  createSeed().incidents.find(
    (item) => item.verification === "unverified" && item.response === "new",
  )!;
const action = (name: string, extras: Record<string, unknown> = {}) =>
  actionSchema.parse({ revision: 0, action: name, note: "", ...extras });
const report = () => ({
  clientId: crypto.randomUUID(),
  hazard: "flood",
  description: "Water has risen across the village access road.",
  district: "Dibrugarh",
  locationName: "Maijan road",
  lat: 27.47,
  lng: 94.91,
  observedAt: new Date().toISOString(),
  language: "en",
  declaration: true,
});
test("report validation accepts a complete observation", () => {
  assert.equal(reportSchema.safeParse(report()).success, true);
});
test("public photo consent requires an explicit boolean and is omitted for legacy payloads", () => {
  assert.equal(reportSchema.parse(report()).publicPhotoConsent, undefined);
  assert.equal(
    reportSchema.parse({ ...report(), publicPhotoConsent: true }).publicPhotoConsent,
    true,
  );
  assert.equal(reportSchema.safeParse({ ...report(), publicPhotoConsent: "true" }).success, false);
});
test("report validation rejects unsupported coordinates and future times", () => {
  assert.equal(reportSchema.safeParse({ ...report(), lat: 91 }).success, false);
  assert.equal(reportSchema.safeParse({ ...report(), lng: 0 }).success, false);
  assert.equal(
    reportSchema.safeParse({
      ...report(),
      observedAt: new Date(Date.now() + 86400000).toISOString(),
    }).success,
    false,
  );
});
test("report validation rejects short descriptions, unsupported hazards, and missing idempotency keys", () => {
  for (const change of [{ description: "help" }, { hazard: "earthquake" }, { clientId: "" }])
    assert.equal(reportSchema.safeParse({ ...report(), ...change }).success, false);
});
test("an urgent unverified incident may be assigned without claiming verification", () => {
  const incident = base();
  incident.priority = "critical";
  const next = applyAction(incident, action("assign", { teamId: "team-1" }), ["team-1"]);
  assert.equal(next.verification, "unverified");
  assert.equal(next.response, "assigned");
  assert.equal(incident.response, "new");
});
test("verification requires recorded evidence", () => {
  assert.throws(() => applyAction(base(), action("verify"), []), /evidence/);
  const next = applyAction(
    base(),
    action("verify", { note: "Volunteer confirmed water level in a direct field check." }),
    [],
  );
  assert.equal(next.verification, "verified");
  assert.equal(next.response, "new");
  assert.ok(next.verifiedAt);
});
test("concurrent stale edits are rejected", () => {
  assert.throws(
    () =>
      applyAction({ ...base(), revision: 2 }, action("note", { note: "A new observation" }), []),
    /changed/,
  );
});
test("response transitions enforce assignment and outcome notes", () => {
  assert.throws(() => applyAction(base(), action("start"), []), /Assign/);
  assert.throws(
    () => applyAction(base(), action("resolve", { note: "Completed assessment" }), []),
    /in-progress/,
  );
  const assigned = applyAction(base(), action("assign", { teamId: "team-1" }), ["team-1"]);
  const progress = applyAction(assigned, action("start", { revision: 1 }), ["team-1"]);
  assert.throws(() => applyAction(progress, action("resolve", { revision: 2 }), []), /outcome/);
  const resolved = applyAction(
    progress,
    action("resolve", { revision: 2, note: "Assessment completed and access restored." }),
    [],
  );
  assert.equal(resolved.response, "resolved");
  assert.equal(resolved.verification, "unverified");
  assert.equal(resolved.history.length, base().history.length + 3);
});
test("rejected reports cannot be assigned and active responses cannot be rejected", () => {
  const rejected = applyAction(
    base(),
    action("reject", { note: "Duplicate observation without new evidence." }),
    [],
  );
  assert.equal(rejected.verification, "rejected");
  assert.equal(rejected.response, "closed");
  assert.throws(
    () => applyAction(rejected, action("assign", { revision: 1, teamId: "team-1" }), ["team-1"]),
    /not open/,
  );
  assert.throws(
    () =>
      applyAction(
        { ...base(), response: "in_progress" },
        action("reject", { note: "Evidence inconclusive on further review." }),
        [],
      ),
    /Close the active/,
  );
});
test("unknown teams and repeated reviews are rejected", () => {
  assert.throws(
    () => applyAction(base(), action("assign", { teamId: "unknown" }), ["team-1"]),
    /available team/,
  );
  assert.throws(
    () => applyAction({ ...base(), verification: "verified" }, action("review"), []),
    /unverified/,
  );
});
test("model output rejects invalid categories and missing uncertainty fields", () => {
  const output = {
    language: "Assamese",
    summary: "Water reported on road.",
    hazard: "flood",
    locationClues: [],
    reportedTime: null,
    impact: [],
    unknownFields: ["count"],
    uncertainty: ["Not verified"],
  };
  assert.equal(analysisSchema.safeParse(output).success, true);
  assert.equal(analysisSchema.safeParse({ ...output, hazard: "verified_flood" }).success, false);
  assert.equal(analysisSchema.safeParse({ ...output, uncertainty: undefined }).success, false);
});
test("seed records have coherent teams, report histories, and explicit demo provenance", () => {
  const seed = createSeed();
  const teamIds = seed.teams.map((team) => team.id);
  assert.ok(
    seed.incidents.every(
      (item) => item.demo && item.reports.every((report) => report.source === "demo"),
    ),
  );
  assert.ok(
    seed.incidents.every((item) => !item.assignedTeamId || teamIds.includes(item.assignedTeamId)),
  );
  assert.ok(
    seed.alerts.every(
      (item) => item.demo && Date.parse(item.expiresAt) > Date.parse(item.issuedAt),
    ),
  );
});
