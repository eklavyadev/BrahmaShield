import { z } from "zod";

export const hazards = ["flood", "landslide", "extreme_weather", "waterlogging"] as const;
export const verificationStates = ["unverified", "under_review", "verified", "rejected"] as const;
export const responseStates = ["new", "assigned", "in_progress", "resolved", "closed"] as const;
export const priorities = ["critical", "high", "medium", "low"] as const;
export type Hazard = (typeof hazards)[number];
export type Verification = (typeof verificationStates)[number];
export type ResponseStatus = (typeof responseStates)[number];
export type Priority = (typeof priorities)[number];

export const analysisSchema = z.object({
  language: z.string().max(100),
  summary: z.string().min(1).max(1500),
  hazard: z.enum([...hazards, "unknown"]),
  locationClues: z.array(z.string().max(200)).max(10),
  reportedTime: z.string().max(200).nullable(),
  impact: z.array(z.string().max(300)).max(10),
  unknownFields: z.array(z.string().max(100)).max(15),
  uncertainty: z.array(z.string().max(300)).max(10),
});
export type AnalysisOutput = z.infer<typeof analysisSchema>;
export interface AIAnalysis extends AnalysisOutput {
  mode: "live" | "demo";
  model: string;
  processedAt: string;
}
export interface HistoryEvent {
  id: string;
  at: string;
  actor: string;
  message: string;
}
export interface IncidentReport {
  id: string;
  description: string;
  language: "en" | "as" | "mixed";
  observedAt: string;
  receivedAt: string;
  source: "community" | "demo";
  imagePath?: string;
  publicPhotoConsent?: boolean;
  publicPhotoConsentAt?: string;
  /** Viewer-specific API projection, never used for server authorization. */
  canViewPhoto?: boolean;
  analysis?: AIAnalysis;
  analysisState: "pending" | "held" | "complete" | "failed";
  quality?: {
    disposition: "standard_review" | "needs_triage";
    signals: string[];
    relatedIncidentIds: string[];
    locationMethod: "gps" | "map" | "manual";
    gpsAccuracyM: number | null;
    evidence: "photo" | "text_only";
    observationSource: "first_hand" | "second_hand";
    reportedImpact: 1 | 2 | 3;
  };
  /** Server-only fields; stripped from public API projections. */
  reporterDeviceHash?: string;
  evidenceDigest?: string;
  declarationAcceptedAt?: string;
  declarationVersion?: string;
  gpsCapturedAt?: string;
}
export interface Incident {
  id: string;
  title: string;
  hazard: Hazard;
  district: string;
  locationName: string;
  lat: number;
  lng: number;
  priority: Priority;
  verification: Verification;
  response: ResponseStatus;
  assignedTeamId: string | null;
  createdAt: string;
  updatedAt: string;
  verifiedAt: string | null;
  revision: number;
  reports: IncidentReport[];
  history: HistoryEvent[];
  demo: boolean;
}
export interface Alert {
  id: string;
  hazard: Hazard;
  title: string;
  district: string;
  severity: "red" | "orange" | "yellow";
  authority: string;
  issuedAt: string;
  expiresAt: string;
  original: string;
  sourceUrl: string;
  demo: boolean;
  sourceType?: "forecast" | "official" | "authority";
}
export interface WeatherForecast {
  district: string;
  date: string;
  rainMm: number | null;
  gustKmh: number | null;
  weatherCode: number | null;
}
export interface WeatherFeed {
  status: "live" | "stale" | "unavailable";
  fetchedAt: string | null;
  message: string;
  forecasts: WeatherForecast[];
  alerts: Alert[];
}
export interface ResponseTeam {
  id: string;
  name: string;
  district: string;
  members: number;
  capability: string;
  checkedAt: string;
  demo: boolean;
}
export interface Shelter {
  id: string;
  name: string;
  district: string;
  lat: number;
  lng: number;
  capacity: number;
  occupied: number;
  checkedAt: string;
  accessible: boolean;
  demo: boolean;
}
export interface Resource {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  teamId: string;
  checkedAt: string;
  demo: boolean;
}
export interface Snapshot {
  incidents: Incident[];
  alerts: Alert[];
  teams: ResponseTeam[];
  shelters: Shelter[];
  resources: Resource[];
  updatedAt: string;
  aiMode: "live" | "demo";
  weatherFeed?: WeatherFeed;
  reliefUpdates?: ReliefUpdate[];
  authorityAdvisories?: AuthorityAdvisory[];
}
export const reliefUpdateSchema = z.object({
  id: z.string().uuid(),
  expectedRevision: z.number().int().nonnegative(),
  kind: z.enum(["camp", "food", "initiative"]),
  district: z.enum([
    "Dibrugarh",
    "Lakhimpur",
    "Dhemaji",
    "Kamrup Metro",
    "Morigaon",
    "Jorhat",
    "Cachar",
    "Dima Hasao",
  ]),
  title: z.string().trim().min(5).max(120),
  location: z.string().trim().min(3).max(160),
  details: z.string().trim().min(15).max(2000),
  sourceUrl: z
    .string()
    .url()
    .max(500)
    .refine((v) => new URL(v).protocol === "https:", "Use an HTTPS source URL."),
  status: z.enum(["active", "closed"]),
  validUntil: z
    .string()
    .datetime()
    .refine((v) => Date.parse(v) > Date.now(), "Validity must be in the future."),
  quantity: z.number().int().min(0).max(1000000).nullable(),
});
export type ReliefUpdateInput = z.infer<typeof reliefUpdateSchema>;
export interface ReliefUpdate extends Omit<ReliefUpdateInput, "expectedRevision"> {
  revision: number;
  updatedAt: string;
  updatedBy: string;
  history?: HistoryEvent[];
}
export const authorityAdvisorySchema = z.object({
  id: z.string().uuid(),
  expectedRevision: z.number().int().nonnegative(),
  title: z.string().trim().min(5).max(120),
  original: z.string().trim().min(15).max(3000),
  district: z.enum([
    "Dibrugarh",
    "Lakhimpur",
    "Dhemaji",
    "Kamrup Metro",
    "Morigaon",
    "Jorhat",
    "Cachar",
    "Dima Hasao",
  ]),
  hazard: z.enum(hazards),
  severity: z.enum(["yellow", "orange", "red"]),
  expiresAt: z
    .string()
    .datetime()
    .refine((v) => Date.parse(v) > Date.now(), "Expiry must be in the future."),
  sourceUrl: z
    .string()
    .url()
    .max(500)
    .refine((v) => new URL(v).protocol === "https:"),
  status: z.enum(["active", "withdrawn"]),
  reason: z.string().trim().min(15).max(1000),
  relatedAlertId: z.string().max(100).optional(),
});
export type AuthorityAdvisoryInput = z.infer<typeof authorityAdvisorySchema>;
export interface AuthorityAdvisory extends Alert {
  district: AuthorityAdvisoryInput["district"];
  revision: number;
  status: "active" | "withdrawn";
  relatedAlertId?: string;
  history: HistoryEvent[];
}
export const reportSchema = z.object({
  clientId: z.string().uuid(),
  hazard: z.enum(hazards),
  description: z
    .string()
    .trim()
    .min(15, "Please describe what happened in at least 15 characters.")
    .max(4000),
  district: z.string().trim().min(2).max(80),
  locationName: z.string().trim().min(3).max(160),
  lat: z.number().min(20).max(30),
  lng: z.number().min(88).max(98),
  observedAt: z
    .string()
    .datetime()
    .refine(
      (value) => Date.parse(value) <= Date.now() + 300000,
      "Occurrence time cannot be in the future.",
    ),
  language: z.enum(["en", "as", "mixed"]),
  imageData: z.string().max(1500000).optional(),
  publicPhotoConsent: z.boolean().optional(),
  declaration: z.literal(true, {
    error:
      "Confirm that your report is truthful and consent to the described use of the report location.",
  }),
  locationMethod: z.enum(["gps", "map", "manual"]).default("manual"),
  gpsAccuracyM: z.number().nonnegative().max(100000).nullable().default(null),
  gpsCapturedAt: z.string().datetime().optional(),
  observationSource: z.enum(["first_hand", "second_hand"]).default("first_hand"),
  impactLevel: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
  website: z.string().max(200).default(""),
});
export type ReportInput = z.infer<typeof reportSchema>;
export const onSiteReportSchema = reportSchema.extend({
  locationMethod: z.literal("gps", { error: "Reports must use your current device GPS location." }),
  gpsAccuracyM: z
    .number()
    .nonnegative()
    .max(200, "GPS accuracy must be within 200 metres. Stay somewhere safe and retry."),
  gpsCapturedAt: z
    .string()
    .datetime()
    .refine(
      (value) =>
        Date.parse(value) <= Date.now() + 60000 && Date.now() - Date.parse(value) <= 300000,
      "Refresh your device location before submitting.",
    ),
  observationSource: z.literal("first_hand", {
    error: "Only firsthand observations at your current location can be reported.",
  }),
  imageData: z.string().min(30, "Attach a photo of the observed hazard.").max(1500000),
});
export const actionSchema = z.object({
  revision: z.number().int().nonnegative(),
  action: z.enum([
    "review",
    "verify",
    "reject",
    "priority",
    "assign",
    "start",
    "resolve",
    "close",
    "note",
    "retry_ai",
    "override",
  ]),
  note: z.string().trim().max(1000).default(""),
  priority: z.enum(priorities).optional(),
  teamId: z.string().max(80).optional(),
  verification: z.enum(verificationStates).optional(),
  response: z.enum(responseStates).optional(),
});
export type IncidentAction = z.infer<typeof actionSchema>;
export const districtNames = [
  "All districts",
  "Dibrugarh",
  "Lakhimpur",
  "Dhemaji",
  "Kamrup Metro",
  "Morigaon",
  "Jorhat",
  "Cachar",
  "Dima Hasao",
];
export const label = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function applyAction(
  incident: Incident,
  input: IncidentAction,
  teamIds: string[],
  now = new Date().toISOString(),
): Incident {
  if (incident.revision !== input.revision)
    throw new Error("This incident changed. Refresh and try again.");
  const next = structuredClone(incident);
  let message = "";
  switch (input.action) {
    case "review":
      if (next.verification !== "unverified")
        throw new Error("Only unverified reports can enter review.");
      next.verification = "under_review";
      message = "Started evidence review";
      break;
    case "verify":
      if (!["unverified", "under_review"].includes(next.verification))
        throw new Error("This incident cannot be verified again.");
      if (input.note.length < 10)
        throw new Error("Describe the evidence used to verify this incident.");
      next.verification = "verified";
      next.verifiedAt = now;
      message = "Verified incident with recorded evidence";
      break;
    case "reject":
      if (!["unverified", "under_review"].includes(next.verification))
        throw new Error("This incident cannot be rejected.");
      if (["assigned", "in_progress"].includes(next.response))
        throw new Error("Close the active response before rejecting this incident.");
      if (input.note.length < 10) throw new Error("Provide a reason for rejecting the report.");
      next.verification = "rejected";
      next.response = "closed";
      message = "Rejected report";
      break;
    case "priority":
      if (!input.priority) throw new Error("Select a priority.");
      next.priority = input.priority;
      message = `Changed priority to ${input.priority}`;
      break;
    case "assign":
      if (next.verification === "rejected" || ["closed", "resolved"].includes(next.response))
        throw new Error("This incident is not open for assignment.");
      if (!input.teamId || !teamIds.includes(input.teamId))
        throw new Error("Select an available team.");
      next.assignedTeamId = input.teamId;
      if (next.response === "new") next.response = "assigned";
      message = "Assigned response team";
      break;
    case "start":
      if (next.response !== "assigned")
        throw new Error("Assign a team before starting a response.");
      next.response = "in_progress";
      message = "Response started";
      break;
    case "resolve":
      if (next.response !== "in_progress")
        throw new Error("Only an in-progress response can be resolved.");
      if (input.note.length < 10)
        throw new Error("Record the outcome before resolving the incident.");
      next.response = "resolved";
      message = "Response resolved";
      break;
    case "close":
      if (next.response === "closed") throw new Error("Incident is already closed.");
      if (input.note.length < 10) throw new Error("Provide a reason for closing this incident.");
      next.response = "closed";
      message = "Incident closed";
      break;
    case "note":
      if (input.note.length < 3) throw new Error("Enter a review note.");
      message = "Added operator note";
      break;
    case "retry_ai":
      next.reports = next.reports.map((report) =>
        report.analysisState === "failed" ? { ...report, analysisState: "pending" } : report,
      );
      message = "Queued AI interpretation retry";
      break;
    case "override":
      if (input.note.length < 15)
        throw new Error("Record the evidence and reason for the authority override.");
      if (!input.priority || !input.verification || !input.response)
        throw new Error("Select priority, verification and response status.");
      if (input.verification === "rejected" && input.response !== "closed")
        throw new Error("Rejected reports must be closed.");
      if (["assigned", "in_progress"].includes(input.response) && !next.assignedTeamId)
        throw new Error("Assign a team before selecting an active response.");
      message = `Authority override: priority ${next.priority} → ${input.priority}; verification ${next.verification} → ${input.verification}; response ${next.response} → ${input.response}`;
      next.priority = input.priority;
      next.verification = input.verification;
      next.response = input.response;
      next.verifiedAt = input.verification === "verified" ? now : null;
      if (input.verification === "rejected") next.assignedTeamId = null;
      break;
  }
  next.updatedAt = now;
  next.revision++;
  next.history.push({
    id: crypto.randomUUID(),
    at: now,
    actor: "Responder",
    message: `${message}${input.note ? ` — ${input.note}` : ""}`,
  });
  return next;
}
