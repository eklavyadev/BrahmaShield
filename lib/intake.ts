import { createHmac, randomBytes, timingSafeEqual, createHash } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Incident, ReportInput } from "./domain";

export interface IntakeQuality {
  disposition: "standard_review" | "needs_triage";
  signals: string[];
  relatedIncidentIds: string[];
  locationMethod: "gps" | "map" | "manual";
  gpsAccuracyM: number | null;
  evidence: "photo" | "text_only";
  observationSource: "first_hand" | "second_hand";
  reportedImpact: 1 | 2 | 3;
}
const globals = globalThis as typeof globalThis & { brahmaIntakeKey?: string };
export function intakeKey() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.BACKEND === "supabase")
    throw new Error(
      "SESSION_SECRET is required with Supabase so all app instances share intake tokens.",
    );
  if (globals.brahmaIntakeKey) return globals.brahmaIntakeKey;
  const dir = path.resolve(/* turbopackIgnore: true */ process.env.DATA_DIRECTORY || ".data");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "intake.key");
  try {
    globals.brahmaIntakeKey = readFileSync(file, "utf8");
  } catch {
    const key = randomBytes(32).toString("hex");
    try {
      writeFileSync(file, key, { flag: "wx", mode: 0o600 });
      globals.brahmaIntakeKey = key;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      globals.brahmaIntakeKey = readFileSync(file, "utf8");
    }
  }
  return globals.brahmaIntakeKey!;
}
export function hashDevice(value: string) {
  return createHmac("sha256", intakeKey()).update(value).digest("hex");
}
export function issueIntakeToken(device: string, now = Date.now()) {
  const payload = Buffer.from(
    JSON.stringify({
      device: hashDevice(device),
      issued: now,
      nonce: randomBytes(12).toString("hex"),
    }),
  ).toString("base64url");
  return `${payload}.${createHmac("sha256", intakeKey()).update(payload).digest("base64url")}`;
}
export function validIntakeToken(token: string, device: string, now = Date.now()) {
  try {
    const [payload, signature] = token.split(".");
    const expected = createHmac("sha256", intakeKey()).update(payload).digest("base64url");
    const one = Buffer.from(signature || "");
    const two = Buffer.from(expected);
    if (one.length !== two.length || !timingSafeEqual(one, two)) return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return (
      data.device === hashDevice(device) &&
      Number.isFinite(data.issued) &&
      data.issued <= now &&
      now - data.issued < 24 * 3600000
    );
  } catch {
    return false;
  }
}
export function normalizeReport(text: string) {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const dlat = (b.lat - a.lat) * rad;
  const dlng = (b.lng - a.lng) * rad;
  const value =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dlng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}
export function imageDigest(imageData: string) {
  return createHash("sha256")
    .update(Buffer.from(imageData.split(",")[1] || "", "base64"))
    .digest("hex");
}
export function assessIntake(
  input: ReportInput,
  incidents: Incident[],
  digest?: string,
): IntakeQuality {
  const signals: string[] = [];
  const normal = normalizeReport(input.description);
  const words = normal.split(" ").filter(Boolean);
  if ((input.description.match(/https?:\/\//gi) || []).length >= 3)
    signals.push("Several external links; check for unsolicited content");
  if (words.length >= 15 && new Set(words).size / words.length < 0.2)
    signals.push("Highly repetitive wording; review for possible spam");
  const related = incidents
    .filter(
      (incident) =>
        !incident.demo &&
        incident.hazard === input.hazard &&
        incident.verification !== "rejected" &&
        distanceMeters(input, incident) < 250 &&
        incident.reports.some(
          (report) =>
            Math.abs(Date.parse(report.observedAt) - Date.parse(input.observedAt)) < 3600000 &&
            normalizeReport(report.description) === normal,
        ),
    )
    .slice(0, 5);
  if (related.length)
    signals.push("Matching text near a recent report; may be a duplicate or corroboration");
  if (
    digest &&
    incidents.some((incident) =>
      incident.reports.some((report) => report.evidenceDigest === digest),
    )
  )
    signals.push("Identical photo already submitted; inspect context before linking");
  if (input.locationMethod === "gps" && input.gpsAccuracyM !== null && input.gpsAccuracyM > 200)
    signals.push("GPS accuracy exceeds 200 m; confirm the reported location");
  if (input.locationMethod === "gps" && input.gpsAccuracyM === null)
    signals.push("GPS accuracy not supplied; location needs confirmation");
  if (input.observationSource === "second_hand")
    signals.push("Second-hand observation; corroboration needed");
  // Text-only evidence and self-reported urgency are not proof of spam or verified severity.
  const suspicious = signals.some((signal) =>
    /unsolicited|repetitive|Identical photo|Matching text/.test(signal),
  );
  return {
    disposition: suspicious ? "needs_triage" : "standard_review",
    signals,
    relatedIncidentIds: related.map((item) => item.id),
    locationMethod: input.locationMethod,
    gpsAccuracyM: input.gpsAccuracyM,
    evidence: input.imageData ? "photo" : "text_only",
    observationSource: input.observationSource,
    reportedImpact: input.impactLevel,
  };
}
