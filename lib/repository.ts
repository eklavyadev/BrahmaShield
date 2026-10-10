import { DatabaseSync } from "node:sqlite";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createSeed } from "./seed";
import { assessIntake, imageDigest } from "./intake";
import { applyReliefUpdate, applyAuthorityAdvisory } from "./relief";
import type { AuthorityAdvisoryInput } from "./domain";
import type { ReliefUpdateInput } from "./domain";
import {
  applyAction,
  type AIAnalysis,
  type Incident,
  type IncidentAction,
  type ReportInput,
  type Snapshot,
} from "./domain";

const globals = globalThis as typeof globalThis & { brahmaDb?: DatabaseSync };
export function dataDirectory() {
  return path.resolve(/* turbopackIgnore: true */ process.env.DATA_DIRECTORY || ".data");
}
function db() {
  if (!globals.brahmaDb) {
    mkdirSync(dataDirectory(), { recursive: true });
    const connection = new DatabaseSync(path.join(dataDirectory(), "brahmashield.sqlite"));
    connection.exec(
      "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY, payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS submissions (client_id TEXT PRIMARY KEY, incident_id TEXT NOT NULL); CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, incident_id TEXT NOT NULL, report_id TEXT NOT NULL, status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, locked_at TEXT);",
    );
    connection
      .prepare("INSERT OR IGNORE INTO state(id, payload) VALUES (1, ?)")
      .run(JSON.stringify(createSeed()));
    globals.brahmaDb = connection;
  }
  return globals.brahmaDb;
}
export function snapshot(): Snapshot {
  const row = db().prepare("SELECT payload FROM state WHERE id = 1").get() as { payload: string };
  return { ...JSON.parse(row.payload), aiMode: process.env.AI_MODE === "live" ? "live" : "demo" };
}
export function saveReliefUpdate(input: ReliefUpdateInput, actor: string) {
  return transaction((state) => applyReliefUpdate(state, input, actor));
}
export function saveAuthorityAdvisory(input: AuthorityAdvisoryInput, actor: string) {
  return transaction((state) => applyAuthorityAdvisory(state, input, actor));
}
function transaction<T>(work: (state: Snapshot) => T): T {
  const connection = db();
  connection.exec("BEGIN IMMEDIATE");
  try {
    const state = snapshot();
    const result = work(state);
    state.updatedAt = new Date().toISOString();
    connection.prepare("UPDATE state SET payload = ? WHERE id = 1").run(JSON.stringify(state));
    connection.exec("COMMIT");
    return result;
  } catch (error) {
    connection.exec("ROLLBACK");
    throw error;
  }
}
export function submitReport(
  input: ReportInput,
  reporterDeviceHash?: string,
): { incident: Incident; duplicate: boolean } {
  return transaction((state) => {
    const previous = db()
      .prepare("SELECT incident_id FROM submissions WHERE client_id = ?")
      .get(input.clientId) as { incident_id: string } | undefined;
    if (previous) {
      const incident = state.incidents.find((item) => item.id === previous.incident_id);
      if (!incident) throw new Error("Previous submission is unavailable.");
      return { incident, duplicate: true };
    }
    const now = new Date().toISOString();
    const id = `BS-${randomUUID().slice(0, 8).toUpperCase()}`;
    const reportId = randomUUID();
    let imagePath: string | undefined;
    if (input.imageData) {
      const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(input.imageData);
      if (!match) throw new Error("Only PNG or JPEG images are supported.");
      const bytes = Buffer.from(match[2], "base64");
      if (bytes.length > 1000000) throw new Error("Image must be under 1 MB.");
      const valid =
        match[1] === "png"
          ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
      if (!valid) throw new Error("Image content does not match its file type.");
      mkdirSync(path.join(dataDirectory(), "uploads"), { recursive: true });
      imagePath = `${reportId}.${match[1] === "png" ? "png" : "jpg"}`;
      writeFileSync(path.join(dataDirectory(), "uploads", imagePath), bytes);
    }
    const digest = input.imageData ? imageDigest(input.imageData) : undefined;
    const quality = assessIntake(input, state.incidents, digest);
    const held = quality.disposition === "needs_triage";
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
          imagePath,
          analysisState: held ? "held" : "pending",
          reporterDeviceHash,
          evidenceDigest: digest,
          quality,
          declarationAcceptedAt: now,
          declarationVersion: "brahmashield-prototype-v1",
          gpsCapturedAt: input.gpsCapturedAt,
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
    state.incidents.unshift(incident);
    db()
      .prepare("INSERT INTO submissions(client_id, incident_id) VALUES (?, ?)")
      .run(input.clientId, id);
    db()
      .prepare("INSERT INTO jobs(id, incident_id, report_id, status) VALUES (?, ?, ?, ?)")
      .run(randomUUID(), id, reportId, held ? "held" : "pending");
    return { incident, duplicate: false };
  });
}
export function updateIncident(id: string, action: IncidentAction, actor = "Responder") {
  return transaction((state) => {
    const index = state.incidents.findIndex((item) => item.id === id);
    if (index < 0) throw new Error("Incident not found.");
    state.incidents[index] = applyAction(
      state.incidents[index],
      action,
      state.teams.map((team) => team.id),
    );
    const history = state.incidents[index].history;
    history[history.length - 1].actor = actor;
    if (
      ["review", "verify"].includes(action.action) ||
      (action.action === "override" && action.verification === "verified")
    ) {
      state.incidents[index].reports = state.incidents[index].reports.map((report) =>
        report.analysisState === "held" ? { ...report, analysisState: "pending" } : report,
      );
      db()
        .prepare("UPDATE jobs SET status = 'pending' WHERE incident_id = ? AND status = 'held'")
        .run(id);
    }
    if (action.action === "retry_ai") {
      db()
        .prepare(
          "UPDATE jobs SET status = 'pending', attempts = 0, locked_at = NULL WHERE incident_id = ? AND status = 'failed'",
        )
        .run(id);
    }
    return state.incidents[index];
  });
}
export function claimJob(): { id: string; incident_id: string; report_id: string } | undefined {
  const connection = db();
  connection.exec("BEGIN IMMEDIATE");
  try {
    connection
      .prepare("UPDATE jobs SET status = 'pending' WHERE status = 'processing' AND locked_at < ?")
      .run(new Date(Date.now() - 120000).toISOString());
    const job = connection
      .prepare(
        "SELECT id, incident_id, report_id FROM jobs WHERE status = 'pending' ORDER BY rowid LIMIT 1",
      )
      .get() as { id: string; incident_id: string; report_id: string } | undefined;
    if (job)
      connection
        .prepare(
          "UPDATE jobs SET status = 'processing', attempts = attempts + 1, locked_at = ? WHERE id = ?",
        )
        .run(new Date().toISOString(), job.id);
    connection.exec("COMMIT");
    return job;
  } catch (error) {
    connection.exec("ROLLBACK");
    throw error;
  }
}
export function finishJob(
  jobId: string,
  incidentId: string,
  reportId: string,
  analysis?: AIAnalysis,
) {
  transaction((state) => {
    const incident = state.incidents.find((item) => item.id === incidentId);
    const report = incident?.reports.find((item) => item.id === reportId);
    if (report && incident) {
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
    }
    db()
      .prepare("UPDATE jobs SET status = ? WHERE id = ?")
      .run(analysis ? "complete" : "failed", jobId);
  });
}
export function attachment(filename: string): Buffer | null {
  if (!/^[a-f0-9-]{36}\.(png|jpg)$/.test(filename)) return null;
  try {
    return readFileSync(path.join(dataDirectory(), "uploads", filename));
  } catch {
    return null;
  }
}
