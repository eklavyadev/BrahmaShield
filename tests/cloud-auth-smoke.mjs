import assert from "node:assert/strict";
const base = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const email = `bs-test-${crypto.randomUUID()}@example.com`;
const password = `Test-${crypto.randomUUID()}`;
let userId;
let cookie = "";
async function admin(path, options = {}) {
  const response = await fetch(`${process.env.SUPABASE_URL}${path}`, {
    ...options,
    headers: { apikey: process.env.SUPABASE_SECRET_KEY, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    const error=await response.json().catch(()=>({}));
    throw new Error(`Test administration request failed (${response.status}, ${error.code||error.error_code||"unknown"}): ${String(error.msg||error.message||error.error_description||"").replaceAll(email,"[test email]").replaceAll(password,"[test password]")}`);
  }
  const text=await response.text();
  return text?JSON.parse(text):null;
}
async function app(path, body, method = "POST") {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: base,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  for (const value of response.headers.getSetCookie()) cookie = value.split(";")[0];
  return response;
}
try {
  const user = await admin("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  userId = user.id;
  assert.ok(userId);
  // A signed Supabase session alone must never grant operational access.
  let login = await app("/api/auth", { email, password });
  assert.equal(login.status, 400);
  assert.equal(cookie, "");
  await admin("/rest/v1/bs_responder_memberships", {
    method: "POST",
    headers: {
      apikey: process.env.SUPABASE_SECRET_KEY,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ user_id: userId, active: true }),
  });
  login = await app("/api/auth", { email, password });
  assert.equal(login.status, 200);
  assert.ok(
    login.headers
      .getSetCookie()
      .some((value) => value.includes("HttpOnly") && value.includes("SameSite=strict")),
  );
  let session = await app("/api/auth", null, "GET");
  assert.equal((await session.json()).responder, true);
  await admin(`/rest/v1/bs_responder_memberships?user_id=eq.${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ active: false }),
  });
  session = await app("/api/auth", null, "GET");
  assert.equal((await session.json()).responder, false);
  const denied = await app(
    "/api/incidents/TEST-NOT-AN-INCIDENT",
    { revision: 0, action: "note", note: "TEST authorization check" },
    "PATCH",
  );
  assert.equal(denied.status, 401);
  await app("/api/auth", null, "DELETE");
  console.log(
    "Cloud authentication passed: nonmembers denied, active membership allowed, HttpOnly session, and immediate membership revocation.",
  );
} finally {
  if (userId) await admin(`/auth/v1/admin/users/${userId}`, { method: "DELETE" });
}
