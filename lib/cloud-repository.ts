import { randomUUID } from "node:crypto";
import {
  applyAction,
  type AIAnalysis,
  type Incident,
  type IncidentAction,
  type ReportInput,
  type Snapshot,
} from "./domain";
import { assessIntake, imageDigest } from "./intake";
import { createSeed } from "./seed";
import { rpc, supabaseRequest, SupabaseError } from "./supabase";

interface VersionedState {
  version: number;
  payload: Snapshot;
}
export interface CloudJob {
  id: string;
  incident_id: string;
  report_id: string;
  lease: string;
}
async function state(): Promise<VersionedState> {
  const seed =
    process.env.SEED_DEMO_DATA === "true"
      ? createSeed()
      : {
          incidents: [],
          alerts: [],
          teams: [],
          shelters: [],
          resources: [],
          updatedAt: new Date().toISOString(),
          aiMode: "live",
        };
  return rpc("bs_snapshot", { initial_state: seed });
}
export async function cloudSnapshot() {
  const current = await state();
  return {
    ...current.payload,
    aiMode: process.env.AI_MODE === "live" ? ("live" as const) : ("demo" as const),
  };
}
function conflict(error: unknown) {
  return error instanceof SupabaseError && error.code === "40001";
}
async function commit(current: VersionedState, options: Record<string, unknown> = {}) {
  current.payload.updatedAt = new Date().toISOString();
  return rpc<{ duplicate: boolean; incident_id?: string }>("bs_commit", {
    expected_version: current.version,
    next_state: current.payload,
    ...options,
  });
}
export function decodeEvidence(data: string) {
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(data);
  if (!match) throw new Error("Only PNG or JPEG images are supported.");
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > 1000000) throw new Error("Image must be under 1 MB.");
  const valid =
    match[1] === "png"
      ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (!valid) throw new Error("Image content does not match its file type.");
  return {
    bytes,
    type: match[1] === "png" ? "image/png" : "image/jpeg",
    extension: match[1] === "png" ? "png" : "jpg",
  };
}
async function putEvidence(filename: string, bytes: Buffer, type: string) {
  await supabaseRequest(`/storage/v1/object/bs-evidence/${filename}`, {
    method: "POST",
    headers: { "Content-Type": type },
    body: new Uint8Array(bytes),
  });
}
async function removeEvidence(filename: string) {
  await supabaseRequest("/storage/v1/object/bs-evidence", {
    method: "DELETE",
    body: JSON.stringify({ prefixes: [filename] }),
  });
}
async function previous(clientId: string, owner: string) {
  return rpc<string | null>("bs_submission", { submission_id: clientId, owner_hash: owner });
}
export async function cloudSubmit(input: ReportInput, owner: string) {
  const existing = await previous(input.clientId, owner);
  if (existing)
    return {
      incident: (await cloudSnapshot()).incidents.find((i) => i.id === existing)!,
      duplicate: true,
    };
  const now = new Date().toISOString(),
    id = `BS-${randomUUID().slice(0, 8).toUpperCase()}`,
    reportId = randomUUID();
  let filename: string | undefined;
  if (input.imageData) {
    const evidence = decodeEvidence(input.imageData);
    filename = `${reportId}.${evidence.extension}`;
    await putEvidence(filename, evidence.bytes, evidence.type);
  }
  const digest = input.imageData ? imageDigest(input.imageData) : undefined;
  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      const current = await state(),
        quality = assessIntake(input, current.payload.incidents, digest),
        held = quality.disposition === "needs_triage";
      const incident: Incident = {
        id,
        title: `${input.hazard.replaceAll("_", " ")} reported at ${input.locationName}`,
        hazard: input.hazard,
        district: input.district,
        locationName: input.locationName,
        lat: input.lat,
        lng: input.lng,
        priority: "medium",
        verification: "unverified",
        response: "new",
        assignedTeamId: null,
        createdAt: now,
        updatedAt: now,
        verifiedAt: null,
        revision: 0,
        demo: false,
        reports: [
          {
            id: reportId,
            description: input.description,
            language: input.language,
            observedAt: input.observedAt,
            receivedAt: now,
            source: "community",
            imagePath: filename,
            analysisState: held ? "held" : "pending",
            reporterDeviceHash: owner,
            evidenceDigest: digest,
            quality,
            declarationAcceptedAt: now,
            declarationVersion: "brahmashield-prototype-v1",
          },
        ],
        history: [
          {
            id: randomUUID(),
            at: now,
            actor: "Community",
            message:
              "Report received. Awaiting human review; no emergency service has been contacted.",
          },
        ],
      };
      current.payload.incidents.unshift(incident);
      try {
        const result = await commit(current, {
          submission: { client_id: input.clientId, incident_id: id, owner_hash: owner },
          job: {
            id: randomUUID(),
            incident_id: id,
            report_id: reportId,
            status: held ? "held" : "pending",
          },
        });
        if (result.duplicate) {
          if (filename) await removeEvidence(filename);
          return {
            incident: (await cloudSnapshot()).incidents.find((i) => i.id === result.incident_id)!,
            duplicate: true,
          };
        }
        return { incident, duplicate: false };
      } catch (error) {
        if (conflict(error)) continue;
        throw error;
      }
    }
    throw new Error("The shared data changed repeatedly. Please retry your saved draft.");
  } catch (error) {
    // A timeout may have committed; check idempotency before deleting evidence or claiming failure.
    const saved = await previous(input.clientId, owner).catch(() => null);
    if (saved)
      return {
        incident: (await cloudSnapshot()).incidents.find((i) => i.id === saved)!,
        duplicate: true,
      };
    // Keep evidence on uncertain network failures; clean orphans with a scheduled retention job.
    throw error;
  }
}
export async function cloudUpdate(id: string, action: IncidentAction, actor: string) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await state(),
      index = current.payload.incidents.findIndex((i) => i.id === id);
    if (index < 0) throw new Error("Incident not found.");
    const next = applyAction(
      current.payload.incidents[index],
      action,
      current.payload.teams.map((t) => t.id),
    );
    next.history[next.history.length - 1].actor = actor;
    if (["review", "verify"].includes(action.action))
      next.reports = next.reports.map((r) =>
        r.analysisState === "held" ? { ...r, analysisState: "pending" } : r,
      );
    current.payload.incidents[index] = next;
    try {
      await commit(current, { job_action: { incident_id: id, action: action.action } });
      return next;
    } catch (error) {
      if (conflict(error)) continue;
      throw error;
    }
  }
  throw new Error("This incident changed. Refresh and try again.");
}
export async function cloudClaim(): Promise<CloudJob | undefined> {
  return (await rpc<CloudJob | null>("bs_claim_job", {})) ?? undefined;
}
export async function cloudFinish(job: CloudJob, analysis?: AIAnalysis) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await state(),
      incident = current.payload.incidents.find((i) => i.id === job.incident_id),
      report = incident?.reports.find((r) => r.id === job.report_id);
    if (!incident || !report) throw new Error("Queued report is missing.");
    report.analysisState = analysis ? "complete" : "failed";
    report.analysis = analysis;
    incident.updatedAt = new Date().toISOString();
    incident.revision++;
    incident.history.push({
      id: randomUUID(),
      at: incident.updatedAt,
      actor: analysis?.mode === "live" ? "Gemma" : "AI adapter",
      message: analysis
        ? `${analysis.mode === "demo" ? "Demo" : "Gemma"} interpretation completed. Verification remains unchanged.`
        : "Interpretation unavailable. Original report remains saved; a responder can retry.",
    });
    try {
      await commit(current, {
        job_finish: { id: job.id, lease: job.lease, status: analysis ? "complete" : "failed" },
      });
      return;
    } catch (error) {
      if (conflict(error)) continue;
      throw error;
    }
  }
  throw new Error("Shared data is busy; the job lease will recover.");
}
export async function cloudAttachment(filename: string): Promise<Buffer | null> {
  if (!/^[a-f0-9-]{36}\.(png|jpg)$/.test(filename)) return null;
  const response = await fetch(
    `${process.env.SUPABASE_URL}/storage/v1/object/authenticated/bs-evidence/${filename}`,
    {
      headers: { apikey: process.env.SUPABASE_SECRET_KEY! },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Evidence storage is unavailable.");
  return Buffer.from(await response.arrayBuffer());
}
