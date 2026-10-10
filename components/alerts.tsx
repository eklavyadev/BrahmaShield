"use client";
import { Translated as T } from "./language";

import { useState } from "react";
import { ExternalLink, Sparkles, Clock3, Search, Radio, Bell, BellOff } from "lucide-react";
import { useApp } from "./provider";
import { DataGate, dateTime, HazardIcon, PageTitle } from "./ui";
import { label } from "@/lib/domain";
import { useLanguage } from "./language";
export function AlertsPage() {
  const { t } = useLanguage();
  const { data, region, lastSynced, notifications } = useApp();
  const feed = data?.weatherFeed;
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("all");
  const [summary, setSummary] = useState<Record<string, { text: string; mode: string }>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const alerts =
    data?.alerts.filter(
      (alert) =>
        (region === "All districts" || region === alert.district) &&
        Date.parse(alert.expiresAt) > Date.parse(lastSynced || "1970-01-01") &&
        (severity === "all" || severity === alert.severity) &&
        `${alert.title} ${alert.district}`.toLowerCase().includes(search.toLowerCase()),
    ) || [];
  async function explain(id: string) {
    setBusy(id);
    setError("");
    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "summarize", alertId: id }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setSummary((previous) => ({ ...previous, [id]: { text: body.answer, mode: body.mode } }));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Explanation unavailable.");
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="WEATHER & ADVISORIES"
        title="Live weather alerts"
        description="District forecasts, forecast advisories, and links to official warnings."
      />
      <div className="panel notification-settings">
        <div>
          <strong>
            <Bell size={15} /> <T text={"Browser notifications"} />{" "}
          </strong>
          <p>
            New advisories for {region.toLowerCase()} while the app stays open. Background tabs may
            update more slowly.
          </p>
          {notifications.permission === "unsupported" && (
            <p>Use a supported browser on HTTPS or localhost.</p>
          )}
          {notifications.permission === "denied" && (
            <p>Blocked by your browser. Allow notifications in site settings.</p>
          )}
          {notifications.message && <p role="status">{notifications.message}</p>}
        </div>
        <div className="button-row">
          <button
            className="button small-button"
            disabled={
              !notifications.ready ||
              notifications.busy ||
              notifications.permission === "unsupported"
            }
            onClick={() => void notifications.toggle()}
          >
            {notifications.enabled ? <BellOff size={14} /> : <Bell size={14} />}
            {t(
              notifications.busy
                ? "Please wait…"
                : notifications.enabled
                  ? "Pause notifications"
                  : "Enable notifications",
            )}
          </button>
          {notifications.enabled && (
            <button
              className="button small-button"
              disabled={notifications.busy}
              onClick={() => void notifications.test()}
            >
              {" "}
              <T text={"Test notification"} />{" "}
            </button>
          )}
        </div>
      </div>
      <DataGate>
        <div className={`notice ${feed?.status === "live" ? "" : "warning"}`}>
          <Radio size={16} />
          <div>
            {feed ? feed.message : "Demo advisories · not issued by authorities."}
            {feed?.fetchedAt && (
              <span className="small">
                {" "}
                · Retrieved {dateTime(feed.fetchedAt)} · refreshes every 15 minutes
              </span>
            )}
          </div>
        </div>
        <div className="button-row official-sources">
          <a
            className="text-link"
            href="https://sachet.ndma.gov.in/"
            target="_blank"
            rel="noreferrer"
          >
            NDMA SACHET <ExternalLink size={13} />
          </a>
          <a
            className="text-link"
            href="https://mausam.imd.gov.in/"
            target="_blank"
            rel="noreferrer"
          >
            IMD official warnings <ExternalLink size={13} />
          </a>
          <a className="text-link" href="https://open-meteo.com/" target="_blank" rel="noreferrer">
            Weather data by Open-Meteo <ExternalLink size={13} />
          </a>
        </div>
        <div className="filter-bar">
          <label className="search-field">
            <Search size={16} />
            <input
              aria-label="Search alerts"
              value={search}
              placeholder="Search advisory or district…"
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <select
            aria-label="Filter advisory level"
            value={severity}
            onChange={(event) => setSeverity(event.target.value)}
          >
            <option value="all">
              {" "}
              <T text={"All advisory levels"} />{" "}
            </option>
            <option value="red">
              {" "}
              <T text={"High"} />{" "}
            </option>
            <option value="orange">
              {" "}
              <T text={"Elevated"} />{" "}
            </option>
            <option value="yellow">
              {" "}
              <T text={"Watch"} />{" "}
            </option>
          </select>
        </div>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="alerts-grid">
          {alerts.map((alert) => (
            <article className={`panel advisory-card alert-${alert.severity}`} key={alert.id}>
              <div className="advisory-top">
                <span
                  className={`badge priority-${alert.severity === "red" ? "critical" : alert.severity === "orange" ? "high" : "medium"}`}
                >
                  {alert.sourceType === "forecast" || alert.sourceType === "authority"
                    ? t({ red: "High", orange: "Elevated", yellow: "Watch" }[alert.severity])
                    : `${label(alert.severity)} warning level`}
                </span>
                <span className="demo-chip">
                  {alert.demo
                    ? "SIMULATED"
                    : alert.sourceType === "forecast"
                      ? "MODEL FORECAST"
                      : alert.sourceType === "authority"
                        ? "AUTHORITY ADVISORY"
                        : "OFFICIAL"}
                </span>
              </div>
              <h2>
                <HazardIcon hazard={alert.hazard} />
                {alert.title}
              </h2>
              <p className="muted">
                {alert.district} · {alert.authority}
              </p>
              <div className="advisory-times">
                <span>
                  <Clock3 size={13} />
                  {t(alert.sourceType === "forecast" ? "Retrieved" : "Issued")}{" "}
                  <time dateTime={alert.issuedAt}>{dateTime(alert.issuedAt)}</time>
                </span>
                <span>
                  {Date.parse(alert.expiresAt) < Date.parse(lastSynced || "1970-01-01")
                    ? "Expired"
                    : "Valid until"}{" "}
                  {dateTime(alert.expiresAt)}
                </span>
              </div>
              <div className="original-advisory">
                <h4>
                  {alert.demo
                    ? "Demonstration text"
                    : alert.sourceType === "forecast"
                      ? "Forecast advisory · not an official warning"
                      : alert.sourceType === "authority"
                        ? "Authority desk advisory · not an upstream official warning"
                        : "Original advisory"}
                </h4>
                <p>{alert.original}</p>
              </div>
              {summary[alert.id] && (
                <div className="alert-explanation">
                  <div className="eyebrow">
                    <Sparkles size={13} />
                    {summary[alert.id].mode === "demo"
                      ? "DEMO EXPLANATION"
                      : "GEMMA EXPLANATION · REVIEW AGAINST ORIGINAL"}
                  </div>
                  <p>{summary[alert.id].text}</p>
                </div>
              )}
              <div className="advisory-footer">
                <a href={alert.sourceUrl} target="_blank" rel="noreferrer" className="text-link">
                  {t(
                    alert.sourceType === "forecast"
                      ? "Forecast source"
                      : alert.sourceType === "authority"
                        ? "Source"
                        : "Official portal",
                  )}{" "}
                  <ExternalLink size={13} />
                </a>
                <button
                  className="button small-button"
                  disabled={!!busy}
                  onClick={() => void explain(alert.id)}
                >
                  <Sparkles size={14} />
                  {t(busy === alert.id ? "Explaining…" : "Explain advisory")}
                </button>
              </div>
            </article>
          ))}
        </div>
        {!alerts.length && (
          <div className="empty-state">
            {feed?.status === "unavailable"
              ? "Forecast service unavailable. Use the official sources above."
              : "No active forecast advisories match this view. This does not confirm that conditions are safe."}
          </div>
        )}
        {feed && feed.forecasts.length > 0 && (
          <>
            <h2 className="forecast-heading">
              {" "}
              <T text={"Three-day district forecast"} />{" "}
            </h2>
            <p className="small">
              Model estimates at district centres, not live measurements. Local conditions can vary.
              Daily precipitation includes the whole calendar day (IST).
            </p>
            <div className="forecast-grid">
              {[...new Set(feed.forecasts.map((row) => row.district))]
                .filter((district) => region === "All districts" || district === region)
                .map((district) => (
                  <article className="panel padded" key={district}>
                    <h3>{district}</h3>
                    {feed.forecasts
                      .filter((row) => row.district === district)
                      .map((row) => (
                        <div className="forecast-day" key={row.date}>
                          <strong>
                            {new Date(`${row.date}T12:00:00+05:30`).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              timeZone: "Asia/Kolkata",
                            })}
                          </strong>
                          <span>
                            Rain{" "}
                            {row.rainMm === null ? "unavailable" : `${row.rainMm.toFixed(1)} mm`}
                          </span>
                          <span>
                            Gusts{" "}
                            {row.gustKmh === null
                              ? "unavailable"
                              : `${row.gustKmh.toFixed(0)} km/h`}
                          </span>
                        </div>
                      ))}
                  </article>
                ))}
            </div>
            <p className="small">
              Advisory rules: daily precipitation ≥50/100/150 mm or gusts ≥50/70/90 km/h for
              Watch/Elevated/High; thunderstorm codes trigger Watch. These are BrahmaShield rules,
              not IMD classifications.
            </p>
          </>
        )}
      </DataGate>
    </>
  );
}
