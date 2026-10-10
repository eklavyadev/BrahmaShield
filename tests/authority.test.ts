import test from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../lib/seed";
import {
  applyAction,
  authorityAdvisorySchema,
  reliefUpdateSchema,
  type Snapshot,
} from "../lib/domain";
import { applyAuthorityAdvisory, applyReliefUpdate } from "../lib/relief";
const newState = (): Snapshot => ({ ...createSeed(), aiMode: "demo" });
test("authority override requires evidence and preserves report originals while recording previous states", () => {
  const incident = newState().incidents[0];
  const action = {
    action: "override" as const,
    revision: incident.revision,
    priority: "high" as const,
    verification: "under_review" as const,
    response: "new" as const,
    note: "Correcting a test review after checking the original evidence.",
  };
  assert.throws(() => applyAction(incident, { ...action, note: "short" }, []), /evidence/);
  const next = applyAction(incident, action, []);
  assert.deepEqual(next.reports, incident.reports);
  assert.equal(next.priority, "high");
  assert.equal(next.verification, "under_review");
  assert.match(next.history.at(-1)!.message, /Authority override: priority/);
  assert.equal(next.revision, incident.revision + 1);
  assert.throws(() => applyAction(next, action, []), /changed/);
  assert.throws(
    () => applyAction(incident, { ...action, verification: "rejected", response: "new" }, []),
    /closed/,
  );
});
test("authority advisories retain forecast records, revision history and withdrawal status", () => {
  const state = newState(),
    originals = structuredClone(state.alerts);
  const input = authorityAdvisorySchema.parse({
    id: crypto.randomUUID(),
    expectedRevision: 0,
    title: "TEST local advisory",
    original: "TEST checking a locally confirmed condition.",
    district: "Dibrugarh",
    hazard: "flood",
    severity: "yellow",
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    sourceUrl: "https://asdma.assam.gov.in/",
    status: "active",
    reason: "TEST authority checked local evidence.",
  });
  const first = applyAuthorityAdvisory(state, input, "test-authority");
  const next = applyAuthorityAdvisory(
    state,
    {
      ...input,
      expectedRevision: 1,
      status: "withdrawn",
      reason: "TEST condition has been reviewed again.",
    },
    "test-authority",
  );
  assert.equal(first.sourceType, "authority");
  assert.equal(next.revision, 2);
  assert.equal(next.history.length, 2);
  assert.equal(next.status, "withdrawn");
  assert.deepEqual(state.alerts, originals);
  assert.throws(() => applyAuthorityAdvisory(state, input, "test-authority"), /changed/);
});
test("relief publication rejects unsafe links, preserves timestamps, and refuses stale edits", () => {
  const state = newState();
  const raw = {
    id: crypto.randomUUID(),
    expectedRevision: 0,
    kind: "food",
    district: "Dibrugarh",
    title: "TEST food distribution",
    location: "TEST community hall",
    details: "TEST schedule for an example distribution only.",
    sourceUrl: "https://asdma.assam.gov.in/",
    status: "active",
    validUntil: new Date(Date.now() + 3600000).toISOString(),
    quantity: 20,
  };
  assert.equal(
    reliefUpdateSchema.safeParse({ ...raw, sourceUrl: "javascript:alert(1)" }).success,
    false,
  );
  const input = reliefUpdateSchema.parse(raw);
  const update = applyReliefUpdate(state, input, "test-authority");
  assert.equal(update.updatedBy, "test-authority");
  assert.ok(update.updatedAt);
  assert.equal(update.quantity, 20);
  assert.throws(() => applyReliefUpdate(state, input, "test-authority"), /changed/);
});
