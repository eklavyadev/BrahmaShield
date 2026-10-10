import { test } from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../lib/seed";
import { canViewReportPhoto } from "../lib/photo-access";
import { projectSnapshot } from "../lib/projection";

test("legacy photos stay private, while the submitting browser and authorities can view", () => {
  const state = { ...createSeed(), aiMode: "demo" as const };
  const incident = state.incidents[0];
  const report = incident.reports[0];
  report.imagePath = `${crypto.randomUUID()}.jpg`;
  report.reporterDeviceHash = "owner";
  assert.equal(canViewReportPhoto(incident, report, false, null), false);
  assert.equal(canViewReportPhoto(incident, report, false, "other"), false);
  assert.equal(canViewReportPhoto(incident, report, false, "owner"), true);
  assert.equal(canViewReportPhoto(incident, report, true, null), true);
  assert.equal(projectSnapshot(state, false, "owner").incidents[0].reports[0].canViewPhoto, true);
  assert.equal(projectSnapshot(state, false, null).incidents[0].reports[0].canViewPhoto, false);
  assert.equal(
    projectSnapshot(state, false, "owner").incidents[0].reports[0].reporterDeviceHash,
    undefined,
  );
  report.canViewPhoto = true;
  assert.equal(canViewReportPhoto(incident, report, false, null), false);
  delete report.reporterDeviceHash;
  assert.equal(canViewReportPhoto(incident, report, false, null), false);
});

test("consented photos respect moderation holds, verification and rejection", () => {
  const incident = createSeed().incidents[0];
  const report = incident.reports[0];
  report.imagePath = `${crypto.randomUUID()}.jpg`;
  report.publicPhotoConsent = true;
  incident.verification = "unverified";
  assert.equal(canViewReportPhoto(incident, report, false, null), true);
  report.quality = {
    disposition: "needs_triage",
    signals: [],
    relatedIncidentIds: [],
    locationMethod: "gps",
    gpsAccuracyM: 10,
    evidence: "photo",
    observationSource: "first_hand",
    reportedImpact: 2,
  };
  assert.equal(canViewReportPhoto(incident, report, false, null), false);
  incident.verification = "verified";
  assert.equal(canViewReportPhoto(incident, report, false, null), true);
  incident.verification = "rejected";
  assert.equal(canViewReportPhoto(incident, report, false, null), false);
  assert.equal(canViewReportPhoto(incident, report, true, null), true);
});
