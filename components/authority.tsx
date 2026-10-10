"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { LockKeyhole, LogOut, ShieldCheck } from "lucide-react";
import { useApp } from "./provider";
import { PageTitle, dateTime, VerificationBadge } from "./ui";
import {
  districtNames,
  priorities,
  responseStates,
  verificationStates,
  hazards,
  label,
  type AuthorityAdvisory,
  type AuthorityAdvisoryInput,
  type Priority,
  type Verification,
  type ResponseStatus,
} from "@/lib/domain";
import { Translated as T } from "./language";
type AdvisoryDraft = Omit<AuthorityAdvisoryInput, "id" | "expiresAt"> & {
  id?: string;
  expiresAt: string;
};
function emptyAdvisory(): AdvisoryDraft {
  return {
    expectedRevision: 0,
    title: "",
    original: "",
    district: "Dibrugarh",
    hazard: "extreme_weather",
    severity: "yellow",
    expiresAt: "",
    sourceUrl: "",
    status: "active",
    reason: "",
    relatedAlertId: "",
  };
}
export function AuthorityDashboard() {
  const { data, refresh, refreshAuth, region } = useApp();
  const [authority, setAuthority] = useState(false),
    [checked, setChecked] = useState(false),
    [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [selected, setSelected] = useState("");
  const [priority, setPriority] = useState<Priority>("medium"),
    [verification, setVerification] = useState<Verification>("unverified"),
    [responseStatus, setResponseStatus] = useState<ResponseStatus>("new");
  const [reason, setReason] = useState(""),
    [advisory, setAdvisory] = useState<AdvisoryDraft>(emptyAdvisory);
  useEffect(() => {
    void fetch("/api/authority-auth", { cache: "no-store" })
      .then((r) => r.json())
      .then((body) => setAuthority(body.authority === true))
      .catch(() => {})
      .finally(() => setChecked(true));
  }, []);
  async function request(url: string, body?: unknown, method = "POST") {
    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await r.json();
    if (!r.ok) throw new Error(result.error || "Unable to save changes.");
    return result;
  }
  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await request("/api/authority-auth", { password });
      setAuthority(true);
      setPassword("");
      await refreshAuth();
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Access unavailable.");
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    setBusy(true);
    try {
      await request("/api/authority-auth", undefined, "DELETE");
      setAuthority(false);
      await refreshAuth();
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to sign out.");
    } finally {
      setBusy(false);
    }
  }
  const incident = data?.incidents.find((item) => item.id === selected);
  function choose(id: string) {
    setSelected(id);
    const item = data?.incidents.find((i) => i.id === id);
    if (item) {
      setPriority(item.priority);
      setVerification(item.verification);
      setResponseStatus(item.response);
    }
    setReason("");
    setMessage("");
  }
  async function override(event: React.FormEvent) {
    event.preventDefault();
    if (!incident) return;
    setBusy(true);
    setMessage("");
    try {
      await request(
        `/api/incidents/${incident.id}`,
        {
          revision: incident.revision,
          action: "override",
          priority,
          verification,
          response: responseStatus,
          note: reason,
        },
        "PATCH",
      );
      await refresh();
      setReason("");
      setMessage("Override saved with an audit record. Original evidence is preserved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Override failed.");
    } finally {
      setBusy(false);
    }
  }
  function editAdvisory(item: AuthorityAdvisory) {
    const date = new Date(item.expiresAt);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    setAdvisory({
      ...item,
      expectedRevision: item.revision,
      reason: "",
      expiresAt: date.toISOString().slice(0, 16),
    });
    setMessage("");
  }
  async function publish(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const id = advisory.id || crypto.randomUUID();
    setAdvisory((old) => ({ ...old, id }));
    try {
      await request("/api/authority-advisories", {
        ...advisory,
        id,
        expiresAt: new Date(advisory.expiresAt).toISOString(),
      });
      await refresh();
      setAdvisory(emptyAdvisory());
      setMessage("Authority advisory saved. Original forecasts remain available.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save advisory.");
    } finally {
      setBusy(false);
    }
  }
  if (!checked) return <div className="empty-state">Checking authority access…</div>;
  if (!authority)
    return (
      <div className="authority-login panel padded">
        <LockKeyhole size={30} />
        <h1>
          <T text="Authority dashboard" />
        </h1>
        <p>Enter the authority password to review reports and manage public updates.</p>
        <form onSubmit={(e) => void signIn(e)}>
          <label>
            <T text={"Password"} />
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="button primary" disabled={busy}>
            <T text={"Open dashboard"} />
          </button>
        </form>
        {message && (
          <p role="alert" className="form-error">
            {message}
          </p>
        )}
      </div>
    );
  return (
    <>
      <PageTitle
        title="Authority dashboard"
        description="Review evidence, override incident states, and publish traceable public updates."
      >
        <button className="button" disabled={busy} onClick={() => void signOut()}>
          <LogOut size={15} />
          <T text={"Sign out"} />
        </button>
      </PageTitle>
      <div className="notice warning">
        <ShieldCheck size={18} />
        Prototype authority access. A shared password identifies the authority desk, not an
        individual official. Actions are audited; no rescue team is automatically dispatched.
      </div>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      <div className="button-row authority-links">
        <Link className="button" href="/relief">
          <T text={"Manage relief updates"} />
        </Link>
        <Link className="button" href="/response">
          Response workspace
        </Link>
        <Link className="button" href="/alerts">
          Public alerts
        </Link>
      </div>
      <div className="authority-grid">
        <form className="panel padded" onSubmit={(e) => void override(e)}>
          <h2>
            <T text={"Incident override"} />
          </h2>
          <p>Choose a report, inspect its evidence, and record why the status needs correcting.</p>
          <fieldset disabled={busy}>
            <label>
              Incident
              <select required value={selected} onChange={(e) => choose(e.target.value)}>
                <option value="">Select a report</option>
                {data?.incidents
                  .filter((i) => region === "All districts" || i.district === region)
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.id} · {i.locationName}
                    </option>
                  ))}
              </select>
            </label>
            {incident && (
              <>
                <div className="button-row">
                  <VerificationBadge value={incident.verification} />
                  <Link href={`/incidents/${incident.id}`} className="text-link">
                    Review evidence →
                  </Link>
                </div>
                <label>
                  <T text="Priority" />
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as Priority)}
                  >
                    {priorities.map((p) => (
                      <option key={p} value={p}>
                        {label(p)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <T text="Verification" />
                  <select
                    value={verification}
                    onChange={(e) => setVerification(e.target.value as Verification)}
                  >
                    {verificationStates.map((v) => (
                      <option key={v} value={v}>
                        {label(v)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <T text="Response" />
                  <select
                    value={responseStatus}
                    onChange={(e) => setResponseStatus(e.target.value as ResponseStatus)}
                  >
                    {responseStates.map((r) => (
                      <option key={r} value={r}>
                        {label(r)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <T text={"Evidence and reason"} />
                  <textarea
                    required
                    minLength={15}
                    maxLength={1000}
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <button className="button primary">
                  <T text={"Save authority override"} />
                </button>
                <h3>
                  <T text={"Recent audit history"} />
                </h3>
                {incident.history
                  .slice(-4)
                  .reverse()
                  .map((event) => (
                    <p className="small" key={event.id}>
                      {event.message}
                      <br />
                      {event.actor} · {dateTime(event.at)}
                    </p>
                  ))}
              </>
            )}
          </fieldset>
        </form>
        <form className="panel padded" onSubmit={(e) => void publish(e)}>
          <h2>
            <T text={"Authority advisory"} />
          </h2>
          <p>
            Publish a correction or local advisory. Link the source and reference a forecast when
            relevant; the upstream forecast is preserved.
          </p>
          <fieldset disabled={busy}>
            <label>
              <T text="Title" />
              <input
                required
                minLength={5}
                maxLength={120}
                value={advisory.title}
                onChange={(e) => setAdvisory({ ...advisory, title: e.target.value })}
              />
            </label>
            <div className="two-columns">
              <label>
                <T text="District" />
                <select
                  value={advisory.district}
                  onChange={(e) =>
                    setAdvisory({
                      ...advisory,
                      district: e.target.value as AdvisoryDraft["district"],
                    })
                  }
                >
                  {districtNames.slice(1).map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </label>
              <label>
                Hazard
                <select
                  value={advisory.hazard}
                  onChange={(e) =>
                    setAdvisory({ ...advisory, hazard: e.target.value as AdvisoryDraft["hazard"] })
                  }
                >
                  {hazards.map((h) => (
                    <option key={h} value={h}>
                      {label(h)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              <T text={"Advisory level"} />
              <select
                value={advisory.severity}
                onChange={(e) =>
                  setAdvisory({
                    ...advisory,
                    severity: e.target.value as AdvisoryDraft["severity"],
                  })
                }
              >
                <option value="yellow">Watch</option>
                <option value="orange">Elevated</option>
                <option value="red">High</option>
              </select>
            </label>
            <label>
              <T text={"Public advisory text"} />
              <textarea
                required
                minLength={15}
                maxLength={3000}
                rows={4}
                value={advisory.original}
                onChange={(e) => setAdvisory({ ...advisory, original: e.target.value })}
              />
            </label>
            <label>
              <T text="Source URL" />
              <input
                type="url"
                required
                value={advisory.sourceUrl}
                onChange={(e) => setAdvisory({ ...advisory, sourceUrl: e.target.value })}
              />
            </label>
            <label>
              Related forecast (optional)
              <select
                value={advisory.relatedAlertId || ""}
                onChange={(e) => setAdvisory({ ...advisory, relatedAlertId: e.target.value })}
              >
                <option value="">No related forecast</option>
                {data?.alerts
                  .filter((a) => a.sourceType === "forecast")
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              <T text="Valid until" />
              <input
                type="datetime-local"
                required
                value={advisory.expiresAt}
                onChange={(e) => setAdvisory({ ...advisory, expiresAt: e.target.value })}
              />
            </label>
            <label>
              <T text="Status" />
              <select
                value={advisory.status}
                onChange={(e) =>
                  setAdvisory({ ...advisory, status: e.target.value as AdvisoryDraft["status"] })
                }
              >
                <option value="active">Active</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
            </label>
            <label>
              Reason for publication or change
              <textarea
                required
                minLength={15}
                maxLength={1000}
                rows={2}
                value={advisory.reason}
                onChange={(e) => setAdvisory({ ...advisory, reason: e.target.value })}
              />
            </label>
            <div className="button-row">
              <button className="button primary">
                <T text={"Save advisory"} />
              </button>
              <button type="button" className="button" onClick={() => setAdvisory(emptyAdvisory())}>
                <T text={"Clear editor"} />
              </button>
            </div>
          </fieldset>
        </form>
      </div>
      <section className="panel padded">
        <h2>
          <T text={"Published authority advisories"} />
        </h2>
        {!data?.authorityAdvisories?.length && <p>No authority advisories published yet.</p>}
        {data?.authorityAdvisories?.map((item) => (
          <div className="authority-advisory-row" key={item.id}>
            <div>
              <strong>{item.title}</strong>
              <p>
                {item.district} · {item.status} · revision {item.revision} ·{" "}
                {dateTime(item.issuedAt)}
              </p>
              <p className="small">{item.history.at(-1)?.message}</p>
            </div>
            <button
              className="button small-button"
              disabled={busy}
              onClick={() => editAdvisory(item)}
            >
              Edit advisory
            </button>
          </div>
        ))}
      </section>
    </>
  );
}
