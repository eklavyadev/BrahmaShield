"use client";
import { useState } from "react";
import { ExternalLink, Sparkles, Clock3, Search, Radio } from "lucide-react";
import { useApp } from "./provider";
import { DataGate, dateTime, HazardIcon, PageTitle } from "./ui";
import { label } from "@/lib/domain";
export function AlertsPage() {
  const { data, region, lastSynced } = useApp();
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("all");
  const [summary, setSummary] = useState<Record<string, { text: string; mode: string }>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const alerts = data?.alerts.filter(alert => (region === "All districts" || region === alert.district) && (severity === "all" || severity === alert.severity) && `${alert.title} ${alert.district}`.toLowerCase().includes(search.toLowerCase())) || [];
  async function explain(id: string) {
    setBusy(id); setError("");
    try { const response = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task: "summarize", alertId: id }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error); setSummary(previous => ({ ...previous, [id]: { text: body.answer, mode: body.mode } })); } catch (error) { setError(error instanceof Error ? error.message : "Explanation unavailable."); } finally { setBusy(""); }
  }
  return <><PageTitle eyebrow="SOURCE-ATTRIBUTED ADVISORIES" title="Alert center" description="Read the original advisory, check its validity, and request a plain-language explanation."/><DataGate><div className="notice warning"><Radio size={16}/>All current advisories are simulated. Source links lead to official portals for reference; these examples were not issued by those authorities.</div><div className="filter-bar"><label className="search-field"><Search size={16}/><input aria-label="Search alerts" value={search} placeholder="Search advisory or district…" onChange={event => setSearch(event.target.value)}/></label><select aria-label="Filter warning level" value={severity} onChange={event => setSeverity(event.target.value)}><option value="all">All warning levels</option><option value="red">Red</option><option value="orange">Orange</option><option value="yellow">Yellow</option></select></div>{error && <p role="alert" className="form-error">{error}</p>}<div className="alerts-grid">{alerts.map(alert => <article className={`panel advisory-card alert-${alert.severity}`} key={alert.id}><div className="advisory-top"><span className={`badge priority-${alert.severity === "red" ? "critical" : alert.severity === "orange" ? "high" : "medium"}`}>{label(alert.severity)} warning level</span><span className="demo-chip">SIMULATED</span></div><h2><HazardIcon hazard={alert.hazard}/>{alert.title}</h2><p className="muted">{alert.district} · {alert.authority}</p><div className="advisory-times"><span><Clock3 size={13}/>Issued {dateTime(alert.issuedAt)}</span><span>{Date.parse(alert.expiresAt) < Date.parse(lastSynced || "1970-01-01") ? "Expired" : "Valid until"} {dateTime(alert.expiresAt)}</span></div><div className="original-advisory"><h4>Original demonstration text</h4><p>{alert.original}</p></div>{summary[alert.id] && <div className="alert-explanation"><div className="eyebrow"><Sparkles size={13}/>{summary[alert.id].mode === "demo" ? "DEMO EXPLANATION" : "GEMMA EXPLANATION · REVIEW AGAINST ORIGINAL"}</div><p>{summary[alert.id].text}</p></div>}<div className="advisory-footer"><a href={alert.sourceUrl} target="_blank" rel="noreferrer" className="text-link">Official portal <ExternalLink size={13}/></a><button className="button small-button" disabled={!!busy} onClick={() => void explain(alert.id)}><Sparkles size={14}/>{busy === alert.id ? "Explaining…" : "Explain advisory"}</button></div></article>)}</div>{!alerts.length && <div className="empty-state">No advisories match this view.</div>}</DataGate></>;
}
