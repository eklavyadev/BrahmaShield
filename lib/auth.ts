import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { intakeKey } from "./intake";

function secret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production")
    throw new Error("SESSION_SECRET is required for responder sign-in in production.");
  return intakeKey();
}
export function demoLoginAllowed() {
  return !process.env.RESPONDER_PASSWORD && process.env.NODE_ENV !== "production";
}
function equal(a: string, b: string) {
  const one = Buffer.from(a);
  const two = Buffer.from(b);
  return one.length === two.length && timingSafeEqual(one, two);
}
export function validPassword(password: string) {
  const expected = process.env.RESPONDER_PASSWORD || (demoLoginAllowed() ? "demo" : "");
  return !!expected && equal(expected, password);
}
export function createSession() {
  const payload = Buffer.from(
    JSON.stringify({ role: "responder", expires: Date.now() + 8 * 3600000 }),
  ).toString("base64url");
  return `${payload}.${createHmac("sha256", secret()).update(payload).digest("base64url")}`;
}
export async function isResponder() {
  const value = (await cookies()).get("bs-session")?.value;
  if (!value) return false;
  try {
    const [payload, signature] = value.split(".");
    if (
      !payload ||
      !signature ||
      !equal(signature, createHmac("sha256", secret()).update(payload).digest("base64url"))
    )
      return false;
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString());
    return parsed.role === "responder" && parsed.expires > Date.now();
  } catch {
    return false;
  }
}
const limits = new Map<string, { count: number; until: number }>();
export function rateLimit(key: string, max = 30) {
  const now = Date.now();
  if (limits.size > 10000)
    for (const [entry, value] of limits) if (value.until < now) limits.delete(entry);
  const value = limits.get(key);
  if (!value || value.until < now) {
    limits.set(key, { count: 1, until: now + 60000 });
    return;
  }
  value.count++;
  if (value.count > max) throw new Error("Too many requests. Please wait a minute and try again.");
}
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host"))
    throw new Error("Cross-origin requests are not accepted.");
}
export async function readJson(request: Request, limit = 20000): Promise<unknown> {
  if (Number(request.headers.get("content-length") || 0) > limit)
    throw new Error("Request is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Request body is missing.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    length += chunk.value.byteLength;
    if (length > limit) {
      await reader.cancel();
      throw new Error("Request is too large.");
    }
    chunks.push(chunk.value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("Request must contain valid JSON.");
  }
}
export function failure(error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : "Unable to complete this request.";
  const responseStatus = message.startsWith("Too many")
    ? 429
    : message.includes("too large")
      ? 413
      : message.startsWith("Cross-origin")
        ? 403
        : status;
  return Response.json({ error: message }, { status: responseStatus });
}
