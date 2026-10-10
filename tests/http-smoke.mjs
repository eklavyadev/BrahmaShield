import assert from "node:assert/strict";
const base = process.env.SMOKE_BASE_URL || "http://localhost:3000";
let cookie = "";
let token = "";
async function request(url, options = {}) {
  const response = await fetch(`${base}${url}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Origin: base,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(token ? { "X-Intake-Token": token } : {}),
      ...options.headers,
    },
  });
  const setCookies = response.headers.getSetCookie();
  for (const entry of setCookies) {
    const name = entry.split("=")[0];
    cookie = [
      ...cookie.split("; ").filter((item) => item && !item.startsWith(`${name}=`)),
      entry.split(";")[0],
    ].join("; ");
  }
  return response;
}
const initial = await (await request("/api/snapshot")).json();
assert.ok(initial.incidents.length);
const intake = await request("/api/intake");
assert.equal(intake.status, 200);
token = (await intake.json()).token;
const payload = {
  clientId: crypto.randomUUID(),
  hazard: "flood",
  description: `TEST observation ${crypto.randomUUID()}: water is affecting a village approach road. No real emergency is being reported.`,
  district: "Lakhimpur",
  locationName: "TEST · Naoboicha road",
  lat: 27.16,
  lng: 94.09,
  observedAt: new Date().toISOString(),
  language: "en",
  declaration: true,
  locationMethod: "manual",
  gpsAccuracyM: null,
  observationSource: "first_hand",
  impactLevel: 2,
  website: "",
};
assert.equal(
  (
    await request("/api/reports", {
      method: "POST",
      body: JSON.stringify({ ...payload, declaration: false }),
    })
  ).status,
  400,
);
assert.equal(
  (
    await request("/api/reports", {
      method: "POST",
      body: JSON.stringify({ ...payload, website: "spam.example" }),
    })
  ).status,
  422,
);
const submitted = await request("/api/reports", { method: "POST", body: JSON.stringify(payload) });
assert.equal(submitted.status, 201);
const { id } = await submitted.json();
const duplicate = await request("/api/reports", { method: "POST", body: JSON.stringify(payload) });
assert.equal(duplicate.status, 200);
assert.equal((await duplicate.json()).id, id);
const heldResponse = await request("/api/reports", {
  method: "POST",
  body: JSON.stringify({ ...payload, clientId: crypto.randomUUID() }),
});
assert.equal(heldResponse.status, 201);
const held = await heldResponse.json();
assert.equal(held.triage, true);
const ownView = await (await request("/api/snapshot")).json();
assert.equal(
  ownView.incidents.find((item) => item.id === held.id)?.reports[0].analysisState,
  "held",
);
assert.equal(
  ownView.incidents.find((item) => item.id === held.id)?.reports[0].reporterDeviceHash,
  undefined,
);
const publicView = await (await fetch(`${base}/api/snapshot`)).json();
assert.equal(
  publicView.incidents.some((item) => item.id === held.id),
  false,
);
let state = await (await request("/api/snapshot")).json();
let incident = state.incidents.find((item) => item.id === id);
assert.ok(incident);
assert.equal(incident.verification, "unverified");
assert.equal(
  (
    await request(`/api/incidents/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "review", revision: incident.revision }),
    })
  ).status,
  401,
);
const login = await request("/api/auth", {
  method: "POST",
  body: JSON.stringify({ password: process.env.SMOKE_RESPONDER_PASSWORD || "demo" }),
});
assert.equal(login.status, 200);
async function action(name, extras = {}) {
  state = await (await request("/api/snapshot")).json();
  incident = state.incidents.find((item) => item.id === id);
  const response = await request(`/api/incidents/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      action: name,
      revision: incident.revision,
      note: "TEST: simulated field check and workflow validation, not an official observation.",
      ...extras,
    }),
  });
  assert.equal(response.status, 200, await response.clone().text());
  return response.json();
}
await action("review");
await action("verify");
await action("assign", { teamId: initial.teams[0].id });
await action("start");
const resolved = await action("resolve");
assert.equal(resolved.response, "resolved");
assert.equal(resolved.verification, "verified");
state = await (await request("/api/snapshot")).json();
assert.equal(state.incidents.find((item) => item.id === id).response, "resolved");
const ai = await request("/api/ai", {
  method: "POST",
  body: JSON.stringify({
    task: "interpret",
    language: "as",
    text: "নাওবৈচাৰ পথত পানী উঠিছে। কেইজনমান লোক পথৰ সিপাৰে আবদ্ধ হৈ আছে।",
  }),
});
assert.equal(ai.status, 200);
assert.equal((await ai.json()).analysis.mode, "demo");
for (const page of [
  "/",
  "/dashboard",
  "/map",
  "/alerts",
  "/report",
  "/incidents",
  `/incidents/${id}`,
  "/response",
  "/assistant",
  "/preparedness",
])
  assert.equal((await request(page)).status, 200, page);
await request("/api/auth", { method: "DELETE" });
console.log(
  `HTTP smoke passed: submission, consent, honeypot, idempotency, authorization, verification, assignment, resolution, Assamese demo, and 10 pages. Test record: ${id}`,
);
