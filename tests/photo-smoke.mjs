import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const login = await fetch(`${base}/api/authority-auth`, {
  method: "POST",
  headers: { Origin: base, "Content-Type": "application/json" },
  body: JSON.stringify({ password: process.env.TEST_AUTHORITY_PASSWORD || "1234" }),
});
assert.equal(login.status, 200);
const cookie = login.headers.get("set-cookie").split(";")[0];
const snapshot = await (
  await fetch(`${base}/api/snapshot`, { headers: { Cookie: cookie } })
).json();
const record = snapshot.incidents
  .flatMap((incident) => incident.reports)
  .find((report) => report.imagePath && !report.publicPhotoConsent);
assert.ok(record, "This read-only check requires an existing private uploaded photo.");
assert.equal(record.canViewPhoto, true);
const photo = await fetch(`${base}/api/media/${record.imagePath}`, { headers: { Cookie: cookie } });
assert.equal(photo.status, 200);
assert.match(photo.headers.get("content-type"), /^image\/(png|jpeg)$/);
assert.equal(photo.headers.get("cache-control"), "private, no-store");
const bytes = new Uint8Array(await photo.arrayBuffer());
assert.ok(bytes.length > 0);
assert.ok((bytes[0] === 255 && bytes[1] === 216) || (bytes[0] === 137 && bytes[1] === 80));
assert.equal((await fetch(`${base}/api/media/${record.imagePath}`)).status, 401);
assert.equal((await fetch(`${base}/api/media/not-a-valid-filename`)).status, 404);
console.log(
  "Stored evidence loads as an image for authority; old private evidence remains inaccessible anonymously. No operational records changed.",
);
