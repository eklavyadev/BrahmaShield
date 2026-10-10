// Explicit live-backend integration check. Retains labelled TEST observations for audit.
import assert from "node:assert/strict";
import { cloudSnapshot, cloudSubmit, cloudUpdate, cloudAttachment } from "../lib/cloud-repository";
import { reportSchema } from "../lib/domain";
import { projectSnapshot } from "../lib/projection";
async function main() {
  const owner = crypto.randomUUID().replaceAll("-", "");
  const payload = reportSchema.parse({
    clientId: crypto.randomUUID(),
    hazard: "flood",
    description: `TEST backend check ${crypto.randomUUID()}: water reported near a village road. No real emergency; integration test only.`,
    district: "Lakhimpur",
    locationName: "TEST backend observation",
    lat: 27.16,
    lng: 94.09,
    observedAt: new Date().toISOString(),
    language: "en",
    declaration: true,
    imageData:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  });
  const first = await cloudSubmit(payload, owner);
  assert.equal(first.duplicate, false);
  assert.equal(first.incident.verification, "unverified");
  const retry = await cloudSubmit(payload, owner);
  assert.equal(retry.incident.id, first.incident.id);
  assert.equal(retry.duplicate, true);
  await assert.rejects(cloudSubmit(payload, "other-device"));
  const file = first.incident.reports[0].imagePath!;
  assert.ok(
    (await cloudAttachment(file))
      ?.subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  );
  const duplicate = await cloudSubmit({ ...payload, clientId: crypto.randomUUID() }, owner);
  assert.equal(duplicate.incident.reports[0].analysisState, "held");
  const state = await cloudSnapshot();
  assert.ok(
    !projectSnapshot(state, false, null).incidents.some((i) => i.id === duplicate.incident.id),
  );
  assert.ok(
    projectSnapshot(state, false, owner).incidents.some((i) => i.id === duplicate.incident.id),
  );
  const reviewed = await cloudUpdate(
    first.incident.id,
    { revision: 0, action: "review", note: "TEST: starting integration review only" },
    "TEST backend validation",
  );
  await assert.rejects(
    cloudUpdate(
      first.incident.id,
      { revision: 0, action: "note", note: "stale update" },
      "TEST backend validation",
    ),
    /changed/,
  );
  await cloudUpdate(
    first.incident.id,
    {
      revision: reviewed.revision,
      action: "close",
      note: "TEST finished; not a real emergency or responder verification.",
    },
    "TEST backend validation",
  );
  await cloudUpdate(
    duplicate.incident.id,
    { revision: 0, action: "reject", note: "TEST duplicate; no real emergency is being reported." },
    "TEST backend validation",
  );
  // Concurrent independent submissions must survive snapshot compare-and-swap retries.
  const observations = await Promise.all(
    [1, 2].map((index) =>
      cloudSubmit(
        {
          ...payload,
          imageData: undefined,
          clientId: crypto.randomUUID(),
          description: `TEST concurrency ${crypto.randomUUID()} observation ${index}; no actual emergency.`,
        },
        owner,
      ),
    ),
  );
  const final = await cloudSnapshot();
  for (const observation of observations) {
    assert.ok(final.incidents.some((i) => i.id === observation.incident.id));
    await cloudUpdate(
      observation.incident.id,
      { revision: 0, action: "close", note: "TEST concurrency complete; no real hazard." },
      "TEST backend validation",
    );
  }
  console.log(
    "Cloud integration passed: persistent reports, device-bound idempotency, private storage, duplicate triage, revision conflicts, and concurrent saves.",
  );
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Cloud check failed");
  process.exitCode = 1;
});
