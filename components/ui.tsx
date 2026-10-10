"use client";
import Link from "next/link";
import {
  ArrowUpRight,
  Waves,
  Mountain,
  CloudLightning,
  Droplets,
  ShieldCheck,
  Clock3,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import type { Hazard, Incident, Priority, Verification } from "@/lib/domain";
import { label } from "@/lib/domain";
import { useApp } from "./provider";
export function HazardIcon({ hazard, size = 18 }: { hazard: Hazard; size?: number }) {
  const Icon =
    hazard === "flood"
      ? Waves
      : hazard === "landslide"
        ? Mountain
        : hazard === "extreme_weather"
          ? CloudLightning
          : Droplets;
  return <Icon size={size} />;
}
export function PriorityBadge({ value }: { value: Priority }) {
  return (
    <span className={`badge priority-${value}`}>
      <span className="tiny-dot" />
      {label(value)}
    </span>
  );
}
export function VerificationBadge({ value }: { value: Verification }) {
  return (
    <span className={`verification verification-${value}`}>
      {value === "verified" ? <ShieldCheck size={13} /> : <Clock3 size={13} />} {label(value)}
    </span>
  );
}
export function relativeTime(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  return minutes < 1
    ? "Just now"
    : minutes < 60
      ? `${minutes}m ago`
      : minutes < 1440
        ? `${Math.floor(minutes / 60)}h ago`
        : `${Math.floor(minutes / 1440)}d ago`;
}
export function dateTime(value: string) {
  return (
    new Date(value).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }) + " IST"
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="page-actions">{children}</div>
    </div>
  );
}
export function DataGate({ children }: { children: React.ReactNode }) {
  const { data, loading, error, refresh } = useApp();
  if (!data)
    return (
      <div className="empty-state">
        {loading ? (
          <>
            <RefreshCw className="spin teal" />
            <h3>Loading the shared picture…</h3>
          </>
        ) : (
          <>
            <AlertCircle className="amber" />
            <h3>Data is unavailable</h3>
            <p>{error}</p>
            <button className="button" onClick={() => void refresh()}>
              Retry connection
            </button>
          </>
        )}
      </div>
    );
  return (
    <>
      {error && (
        <div className="notice warning">
          Connection interrupted. Displaying the last received data.{" "}
          <button onClick={() => void refresh()}>Retry</button>
        </div>
      )}
      {children}
    </>
  );
}
export function IncidentTable({
  incidents,
  compact = false,
}: {
  incidents: Incident[];
  compact?: boolean;
}) {
  if (!incidents.length)
    return (
      <div className="empty-state">
        <h3>No incidents match these filters</h3>
        <p>Try a different district, hazard, or status.</p>
      </div>
    );
  return (
    <div className="table-scroll">
      <table className={compact ? "incident-table compact" : "incident-table"}>
        <thead>
          <tr>
            <th>Incident / location</th>
            <th>Priority</th>
            <th>Verification</th>
            {!compact && <th>Response</th>}
            <th>Reported</th>
            <th>
              <span className="sr-only">Details</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {incidents.map((item) => (
            <tr key={item.id}>
              <td>
                <div className="table-incident">
                  <span className={`hazard-tile hazard-${item.hazard}`}>
                    <HazardIcon hazard={item.hazard} />
                  </span>
                  <div>
                    <Link className="incident-name" href={`/incidents/${item.id}`}>
                      {item.title}
                    </Link>
                    <div className="small muted">
                      {item.id} · {item.district}{" "}
                      {item.demo && <span className="demo-inline">DEMO</span>}
                      {item.verification !== "verified" &&
                        item.reports.some(
                          (report) => report.quality?.disposition === "needs_triage",
                        ) && <span className="quality-tag">TRIAGE</span>}
                    </div>
                  </div>
                </div>
              </td>
              <td>
                <PriorityBadge value={item.priority} />
              </td>
              <td>
                <VerificationBadge value={item.verification} />
              </td>
              {!compact && (
                <td>
                  <span className={`response-label response-${item.response}`}>
                    {label(item.response)}
                  </span>
                </td>
              )}
              <td className="small muted">
                <time dateTime={item.createdAt} title={dateTime(item.createdAt)}>
                  {relativeTime(item.createdAt)}
                </time>
              </td>
              <td>
                <Link
                  className="icon-button"
                  aria-label={`Open ${item.id}`}
                  href={`/incidents/${item.id}`}
                >
                  <ArrowUpRight size={16} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
