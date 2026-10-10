"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  Clock3,
  Sparkles,
  ShieldCheck,
  LockKeyhole,
  CheckCircle2,
  UserRoundCheck,
  Play,
  RefreshCw,
  FileImage,
} from "lucide-react";
import { useApp } from "./provider";
import { DataGate, dateTime, HazardIcon, PageTitle, PriorityBadge, VerificationBadge } from "./ui";
import { IncidentMap } from "./maps/map";
import { label, priorities, type IncidentAction } from "@/lib/domain";
export function IncidentDetail({ id }: { id: string }) {
  const { data, responder, refresh } = useApp();
  const incident = data?.incidents.find((item) => item.id === id);
  const [note, setNote] = useState("");
  const [team, setTeam] = useState("");
  const [priority, setPriority] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  async function action(name: IncidentAction["action"]) {
    if (!incident) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`/api/incidents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revision: incident.revision,
          action: name,
          note,
          teamId: team || incident.assignedTeamId || undefined,
          priority: priority || incident.priority,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await refresh();
      setNote("");
      setSuccess("Action recorded in the shared incident history.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to save this action.");
      if (error instanceof Error && error.message.includes("changed")) await refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <DataGate>
      {!incident ? (
        <div className="empty-state">
          <h1>Incident not found</h1>
          <p>Check the ID or open the incident register.</p>
          <Link className="button" href="/incidents">
            View incidents
          </Link>
        </div>
      ) : (
        <>
          <Link href="/incidents" className="back-link">
            <ArrowLeft size={15} />
            Incident register
          </Link>
          <PageTitle
            eyebrow={`${incident.id} · ${incident.demo ? "SIMULATED DEMO RECORD" : "COMMUNITY REPORT"}`}
            title={incident.title}
            description={`${incident.locationName} · ${incident.district}`}
          >
            <PriorityBadge value={incident.priority} />
            <VerificationBadge value={incident.verification} />
          </PageTitle>
          {incident.demo && (
            <div className="notice warning">
              This entire incident is a demonstration, including its verification and team
              assignments.
            </div>
          )}
          <div className="detail-layout">
            <div className="detail-content">
              <section className="panel">
                <div className="panel-heading">
                  <h2>
                    <HazardIcon hazard={incident.hazard} />
                    Original community observations
                  </h2>
                  <span className="count-chip">{incident.reports.length}</span>
                </div>
                {incident.reports.map((report) => (
                  <article className="original-report" key={report.id}>
                    <div className="report-meta">
                      <span className="badge neutral">
                        {report.language === "as" ? "অসমীয়া / Assamese" : label(report.language)}
                      </span>
                      <span>{report.source === "demo" ? "DEMO" : "Community submitted"}</span>
                    </div>
                    {report.quality && (
                      <div className="quality-panel">
                        <h4>
                          Intake quality ·{" "}
                          {report.quality.disposition === "needs_triage"
                            ? "Held for spam / duplicate triage"
                            : "Standard human review"}
                        </h4>
                        <p>
                          Evidence:{" "}
                          {report.quality.evidence === "photo"
                            ? "Private photo attached"
                            : "Text only; photo optional"}{" "}
                          · {label(report.quality.observationSource)} · reported impact{" "}
                          {report.quality.reportedImpact}/3
                        </p>
                        <p>
                          Location: {label(report.quality.locationMethod)}
                          {report.quality.gpsAccuracyM !== null
                            ? ` · device GPS uncertainty ±${report.quality.gpsAccuracyM} m`
                            : " · accuracy not measured"}
                        </p>
                        {report.quality.signals.length > 0 && (
                          <ul className="quality-signals">
                            {report.quality.signals.map((signal) => (
                              <li key={signal}>{signal}</li>
                            ))}
                          </ul>
                        )}
                        {report.quality.relatedIncidentIds.length > 0 && (
                          <div className="quality-links">
                            {report.quality.relatedIncidentIds.map((related) => (
                              <Link
                                className="text-link"
                                href={`/incidents/${related}`}
                                key={related}
                              >
                                Compare {related}
                              </Link>
                            ))}
                          </div>
                        )}
                        <small className="muted">
                          Automated signals support triage; they do not prove spam, authenticity, or
                          severity.
                        </small>
                      </div>
                    )}
                    <blockquote lang={report.language === "as" ? "as" : "en"}>
                      {report.description}
                    </blockquote>
                    <div className="metadata-row">
                      <span>
                        <Clock3 size={13} />
                        Observed {dateTime(report.observedAt)}
                      </span>
                      <span>Received {dateTime(report.receivedAt)}</span>
                    </div>
                    {report.imagePath && (
                      <div className="attachment-link">
                        <FileImage size={15} />
                        {responder ? (
                          <a
                            target="_blank"
                            rel="noreferrer"
                            href={`/api/media/${report.imagePath}`}
                          >
                            View private evidence photo
                          </a>
                        ) : (
                          <span>Evidence photo · responder access required</span>
                        )}
                      </div>
                    )}
                  </article>
                ))}
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <h2>
                    <Sparkles size={16} className="teal" />
                    Report interpretation
                  </h2>
                  <span className="ai-tag">GEMMA ADAPTER</span>
                </div>
                {incident.reports.map((report) => (
                  <article className="ai-analysis" key={report.id}>
                    {report.analysis ? (
                      <>
                        <div className="analysis-top">
                          <span
                            className={`badge ${report.analysis.mode === "live" ? "priority-low" : "priority-medium"}`}
                          >
                            {report.analysis.mode === "live"
                              ? "Gemma generated"
                              : "DEMO · deterministic"}
                          </span>
                          <span className="small muted">{report.analysis.model}</span>
                        </div>
                        <p className="analysis-summary">{report.analysis.summary}</p>
                        <div className="two-columns">
                          <div>
                            <h4>Extracted location clues</h4>
                            <p>
                              {report.analysis.locationClues.join(", ") ||
                                "No location clues extracted"}
                            </p>
                            <h4>Reported impact</h4>
                            <ul>
                              {report.analysis.impact.length ? (
                                report.analysis.impact.map((item) => <li key={item}>{item}</li>)
                              ) : (
                                <li>Not established</li>
                              )}
                            </ul>
                          </div>
                          <div>
                            <h4>Unknown fields</h4>
                            <div className="tag-list">
                              {report.analysis.unknownFields.map((item) => (
                                <span className="badge neutral" key={item}>
                                  {item}
                                </span>
                              ))}
                            </div>
                            <h4>Uncertainty</h4>
                            <ul>
                              {report.analysis.uncertainty.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                        <p className="small muted">
                          Interpretation is derived information. It does not verify the incident or
                          set its priority.
                        </p>
                      </>
                    ) : (
                      <div className="empty-state">
                        {report.analysisState === "held" ? (
                          <>
                            <ShieldCheck className="amber" />
                            <h3>Interpretation held for intake review</h3>
                            <p>
                              A responder must start review before AI processing. The original
                              report is saved.
                            </p>
                          </>
                        ) : report.analysisState === "pending" ? (
                          <>
                            <RefreshCw className="spin teal" />
                            <h3>Interpretation queued</h3>
                            <p>
                              Your original report is already saved. This view refreshes
                              automatically.
                            </p>
                          </>
                        ) : (
                          <>
                            <h3>Interpretation unavailable</h3>
                            <p>The original report remains available for human review.</p>
                            {responder && (
                              <button
                                className="button"
                                disabled={busy}
                                onClick={() => void action("retry_ai")}
                              >
                                Retry interpretation
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </article>
                ))}
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <h2>Incident location</h2>
                  <span className="small muted">
                    <MapPin size={12} />
                    {incident.lat.toFixed(5)}, {incident.lng.toFixed(5)}
                  </span>
                </div>
                <IncidentMap incidents={[incident]} height={285} />
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <h2>Decision & response history</h2>
                  <span className="small muted">AUDIT TRAIL</span>
                </div>
                <div className="detail-timeline">
                  {[...incident.history].reverse().map((event) => (
                    <div className="timeline-event" key={event.id}>
                      <span className="activity-dot" />
                      <div>
                        <strong>{event.message}</strong>
                        <p>
                          {event.actor} · {dateTime(event.at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
            <aside className="detail-side">
              <section className="panel padded">
                <h3>Current response</h3>
                <div className={`response-pill response-${incident.response}`}>
                  {label(incident.response)}
                </div>
                <dl className="detail-facts">
                  <dt>Assigned team</dt>
                  <dd>
                    {data?.teams.find((item) => item.id === incident.assignedTeamId)?.name ||
                      "Not assigned"}
                  </dd>
                  <dt>Verification</dt>
                  <dd>{label(incident.verification)}</dd>
                  <dt>Last changed</dt>
                  <dd>{dateTime(incident.updatedAt)}</dd>
                  <dt>Source</dt>
                  <dd>{incident.demo ? "Simulated demonstration" : "Community observation"}</dd>
                </dl>
                <p className="small muted">
                  Assignments record coordination within this prototype. They do not contact
                  external responders.
                </p>
              </section>
              <section className="panel padded operator-panel">
                <h3>
                  <ShieldCheck size={17} className="teal" />
                  Responder actions
                </h3>
                {!responder ? (
                  <div className="locked-state">
                    <LockKeyhole size={25} />
                    <p>Use the Observer control in the top bar to sign in as a responder.</p>
                    <small>Review and response changes are protected on the server.</small>
                  </div>
                ) : (
                  <>
                    <label>
                      Evidence / action note
                      <textarea
                        rows={4}
                        maxLength={1000}
                        placeholder="Record evidence or outcome. This history may be public; omit private details…"
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                      />
                    </label>
                    <div className="action-buttons">
                      {incident.verification === "unverified" && (
                        <button
                          className="button"
                          disabled={busy}
                          onClick={() => void action("review")}
                        >
                          Start review
                        </button>
                      )}
                      {["unverified", "under_review"].includes(incident.verification) && (
                        <>
                          <button
                            className="button primary"
                            disabled={busy || note.trim().length < 10}
                            onClick={() => void action("verify")}
                          >
                            <ShieldCheck size={14} />
                            Verify evidence
                          </button>
                          <button
                            className="button danger-outline"
                            disabled={
                              busy ||
                              note.trim().length < 10 ||
                              ["assigned", "in_progress"].includes(incident.response)
                            }
                            onClick={() => void action("reject")}
                          >
                            Reject report
                          </button>
                        </>
                      )}
                      <button
                        className="button"
                        disabled={busy || note.trim().length < 3}
                        onClick={() => void action("note")}
                      >
                        Add note
                      </button>
                    </div>
                    <small className="muted">
                      Verification, rejection, resolution, and closure require an evidence or
                      outcome note.
                    </small>
                    <div className="action-divider" />
                    <label>
                      Priority
                      <select
                        value={priority || incident.priority}
                        onChange={(event) => setPriority(event.target.value)}
                      >
                        {priorities.map((item) => (
                          <option value={item} key={item}>
                            {label(item)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="button full-width"
                      disabled={busy || !priority || priority === incident.priority}
                      onClick={() => void action("priority")}
                    >
                      Update priority
                    </button>
                    {!["closed", "resolved"].includes(incident.response) &&
                      incident.verification !== "rejected" && (
                        <>
                          <label>
                            Response team
                            <select
                              value={team || incident.assignedTeamId || ""}
                              onChange={(event) => setTeam(event.target.value)}
                            >
                              <option value="">Choose a team…</option>
                              {data?.teams.map((item) => (
                                <option value={item.id} key={item.id}>
                                  {item.name} · DEMO
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            className="button full-width"
                            disabled={busy || !(team || incident.assignedTeamId)}
                            onClick={() => void action("assign")}
                          >
                            <UserRoundCheck size={14} />
                            Assign team
                          </button>
                        </>
                      )}
                    {incident.response === "assigned" && (
                      <button
                        className="button primary full-width"
                        disabled={busy}
                        onClick={() => void action("start")}
                      >
                        <Play size={14} />
                        Start response
                      </button>
                    )}
                    {incident.response === "in_progress" && (
                      <button
                        className="button primary full-width"
                        disabled={busy || note.trim().length < 10}
                        onClick={() => void action("resolve")}
                      >
                        <CheckCircle2 size={14} />
                        Resolve response
                      </button>
                    )}
                    {incident.response !== "closed" && (
                      <button
                        className="button full-width"
                        disabled={busy || note.trim().length < 10}
                        onClick={() => void action("close")}
                      >
                        Close incident
                      </button>
                    )}
                    {error && (
                      <p className="form-error" role="alert">
                        {error}
                      </p>
                    )}
                    {success && (
                      <p className="small teal" role="status">
                        {success}
                      </p>
                    )}
                  </>
                )}
              </section>
            </aside>
          </div>
        </>
      )}
    </DataGate>
  );
}
