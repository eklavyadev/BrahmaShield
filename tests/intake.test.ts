import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { reportSchema } from "../lib/domain";
import { assessIntake, distanceMeters, issueIntakeToken, validIntakeToken } from "../lib/intake";
import { createSeed } from "../lib/seed";
process.env.DATA_DIRECTORY = mkdtempSync(path.join(tmpdir(), "brahmashield-intake-test-"));
const payload = () =>
  reportSchema.parse({
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
test("declaration is required on the server schema, including direct API payloads", () => {
  assert.equal(reportSchema.safeParse({ ...payload(), declaration: false }).success, false);
  assert.equal(reportSchema.safeParse({ ...payload(), declaration: undefined }).success, false);
});
test("signed intake token binds the reporting device and expires", () => {
  const token = issueIntakeToken("device-a", 1000000);
  assert.equal(validIntakeToken(token, "device-a", 1000001), true);
  assert.equal(validIntakeToken(token, "device-b", 1000001), false);
  assert.equal(validIntakeToken(token + "bad", "device-a", 1000001), false);
  assert.equal(validIntakeToken(token, "device-a", 1000000 + 25 * 3600000), false);
});
test("missing photo and poor GPS do not block urgent reports or claim they are spam", () => {
  const result = assessIntake(
    { ...payload(), impactLevel: 3, locationMethod: "gps", gpsAccuracyM: 450 },
    [],
  );
  assert.equal(result.disposition, "standard_review");
  assert.equal(result.evidence, "text_only");
  assert.equal(result.reportedImpact, 3);
  assert.ok(result.signals.some((value) => value.includes("200 m")));
});
test("similar recent nearby observations are held for comparison, not automatically merged", () => {
  const input = payload();
  const incident = createSeed().incidents[0];
  incident.demo = false;
  incident.lat = input.lat;
  incident.lng = input.lng;
  incident.hazard = input.hazard;
  incident.reports[0].description = input.description;
  incident.reports[0].observedAt = input.observedAt;
  const result = assessIntake(input, [incident]);
  assert.equal(result.disposition, "needs_triage");
  assert.deepEqual(result.relatedIncidentIds, [incident.id]);
  assert.equal(
    assessIntake(
      { ...input, observedAt: new Date(Date.parse(input.observedAt) + 2 * 3600000).toISOString() },
      [incident],
    ).disposition,
    "standard_review",
  );
  assert.ok(distanceMeters(input, { ...input, lat: input.lat + 1 }) > 100000);
});
test("links and excessive repeated wording are review signals; Assamese text is not", () => {
  assert.equal(
    assessIntake(
      {
        ...payload(),
        description: "http://a.test http://b.test http://c.test buy unrelated content",
      },
      [],
    ).disposition,
    "needs_triage",
  );
  assert.equal(
    assessIntake({ ...payload(), description: Array(30).fill("spam").join(" ") }, []).disposition,
    "needs_triage",
  );
  assert.equal(
    assessIntake(
      {
        ...payload(),
        language: "as",
        description: "নাওবৈচাৰ পথত পানী উঠিছে। কেইজনমান লোক পথৰ সিপাৰে আবদ্ধ হৈ আছে।",
      },
      [],
    ).disposition,
    "standard_review",
  );
});
