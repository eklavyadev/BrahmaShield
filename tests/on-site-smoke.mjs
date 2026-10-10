import assert from "node:assert/strict";
const base = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const intake = await fetch(`${base}/api/intake`);
assert.equal(intake.status, 200);
const cookie = intake.headers
  .getSetCookie()
  .map((value) => value.split(";")[0])
  .join("; ");
const { token } = await intake.json();
const payload = {
  clientId: crypto.randomUUID(),
  hazard: "flood",
  description: `TEST site check ${crypto.randomUUID()}: no real emergency.`,
  district: "Lakhimpur",
  locationName: "TEST on-site validation",
  lat: 27.16,
  lng: 94.09,
  observedAt: new Date().toISOString(),
  language: "en",
  declaration: true,
  locationMethod: "gps",
  gpsAccuracyM: 20,
  gpsCapturedAt: new Date().toISOString(),
  observationSource: "first_hand",
  imageData:
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
};
async function submit(change = {}) {
  return fetch(`${base}/api/reports`, {
    method: "POST",
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      Cookie: cookie,
      "X-Intake-Token": token,
    },
    body: JSON.stringify({ ...payload, ...change }),
  });
}
for (const change of [
  { locationMethod: "manual" },
  { locationMethod: "map" },
  { gpsAccuracyM: 201 },
  { gpsCapturedAt: new Date(Date.now() - 360000).toISOString() },
  { imageData: undefined },
])
  assert.equal((await submit(change)).status, 400);
const response = await submit();
assert.equal(response.status, 201);
const saved = await response.json();
assert.equal((await submit()).status, 200);
console.log(
  `On-site HTTP checks passed: manual/map/stale/inaccurate/missing-photo rejected; GPS photo report saved idempotently (${saved.id}). TEST record retained.`,
);
