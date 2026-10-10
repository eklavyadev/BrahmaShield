import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
async function request(path, { method = "GET", body, cookie, origin = base } = {}) {
  return fetch(`${base}${path}`, {
    method,
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
assert.equal((await request("/api/authority-auth")).status, 200);
for (const path of ["/api/authority-advisories", "/api/relief"]) {
  assert.equal((await request(path, { method: "POST", body: {} })).status, 401);
}
assert.equal(
  (await request("/api/authority-auth", { method: "POST", body: { password: "wrong" } })).status,
  401,
);
const login = await request("/api/authority-auth", {
  method: "POST",
  body: { password: process.env.TEST_AUTHORITY_PASSWORD || "1234" },
});
assert.equal(login.status, 200);
const cookie = login.headers.get("set-cookie")?.split(";")[0];
assert.ok(cookie?.startsWith("bs-authority="));
assert.equal((await (await request("/api/authority-auth", { cookie })).json()).authority, true);
assert.equal(
  (await (await request("/api/authority-auth", { cookie: `${cookie}tampered` })).json()).authority,
  false,
);
for (const path of ["/api/authority-advisories", "/api/relief"]) {
  assert.equal((await request(path, { method: "POST", body: {}, cookie })).status, 400);
  assert.equal(
    (await request(path, { method: "POST", body: {}, cookie, origin: "https://example.invalid" }))
      .status,
    403,
  );
}
assert.equal((await request("/api/authority-auth", { method: "DELETE", cookie })).status, 200);
const snapshot = await (await request("/api/snapshot")).json();
assert.ok(snapshot.weatherFeed);
assert.ok(["live", "stale", "unavailable"].includes(snapshot.weatherFeed.status));
assert.ok(
  snapshot.alerts.every(
    (alert) => alert.sourceType === "forecast" || alert.sourceType === "authority",
  ),
);
console.log(
  `Authority access, cookie tampering, input validation and source isolation passed; weather feed ${snapshot.weatherFeed.status}. No operational records changed.`,
);
