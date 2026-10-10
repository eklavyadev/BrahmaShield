import { test } from "node:test";
import assert from "node:assert/strict";
import { onSiteReportSchema } from "../lib/domain";
const input = {
  clientId: crypto.randomUUID(),
  hazard: "flood",
  description: "TEST water affecting the nearby road",
  district: "Lakhimpur",
  locationName: "TEST site",
  lat: 27.16,
  lng: 94.09,
  observedAt: new Date().toISOString(),
  language: "en",
  declaration: true,
  locationMethod: "gps",
  gpsAccuracyM: 20,
  gpsCapturedAt: new Date().toISOString(),
  observationSource: "first_hand",
  imageData: "data:image/jpeg;base64," + "A".repeat(32),
};
test("on-site reporting accepts fresh accurate GPS with photo evidence", () =>
  assert.ok(onSiteReportSchema.safeParse(input).success));
test("on-site reporting rejects map/manual points, missing evidence, secondhand reports and inaccurate GPS", () => {
  for (const change of [
    { locationMethod: "map" },
    { locationMethod: "manual" },
    { imageData: undefined },
    { gpsAccuracyM: 201 },
    { gpsAccuracyM: null },
    { gpsCapturedAt: undefined },
    { observationSource: "second_hand" },
  ])
    assert.equal(onSiteReportSchema.safeParse({ ...input, ...change }).success, false);
});
test("on-site reporting rejects stale and future GPS fixes", () => {
  for (const time of [Date.now() - 301000, Date.now() + 61000])
    assert.equal(
      onSiteReportSchema.safeParse({ ...input, gpsCapturedAt: new Date(time).toISOString() })
        .success,
      false,
    );
});
