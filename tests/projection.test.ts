import { test } from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../lib/seed";
import { projectSnapshot } from "../lib/projection";
import type { Snapshot } from "../lib/domain";

test("held intake is visible to its reporter and responders, then published after verification", () => {
  const state: Snapshot = { ...createSeed(), aiMode: "demo" };
  const incident = state.incidents[0];
  incident.demo = false;
  incident.verification = "unverified";
  incident.reports[0].reporterDeviceHash = "owner-hash";
  incident.reports[0].evidenceDigest = "private-photo-hash";
  incident.reports[0].quality = {
    disposition: "needs_triage",
    signals: ["Matching text"],
    relatedIncidentIds: [],
    locationMethod: "manual",
    gpsAccuracyM: null,
    evidence: "text_only",
    observationSource: "first_hand",
    reportedImpact: 3,
  };
  assert.equal(
    projectSnapshot(state, false, null).incidents.some((item) => item.id === incident.id),
    false,
  );
  assert.equal(
    projectSnapshot(state, false, "other-hash").incidents.some((item) => item.id === incident.id),
    false,
  );
  assert.equal(
    projectSnapshot(state, false, "owner-hash").incidents.some((item) => item.id === incident.id),
    true,
  );
  assert.equal(
    projectSnapshot(state, true, null).incidents.some((item) => item.id === incident.id),
    true,
  );
  const returned = projectSnapshot(state, true, null).incidents.find(
    (item) => item.id === incident.id,
  )!;
  assert.equal(returned.reports[0].reporterDeviceHash, undefined);
  assert.equal(returned.reports[0].evidenceDigest, undefined);
  assert.equal(incident.reports[0].reporterDeviceHash, "owner-hash");
  incident.verification = "verified";
  assert.equal(
    projectSnapshot(state, false, null).incidents.some((item) => item.id === incident.id),
    true,
  );
});
