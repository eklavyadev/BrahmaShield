"use client";
import { useState } from "react";
import Link from "next/link";
import { useApp } from "./provider";
import { HazardIcon, VerificationBadge, dateTime } from "./ui";
import { Translated as T } from "./language";
export function PublicReports() {
  const { data, region } = useApp();
  const [reviewedOnly, setReviewedOnly] = useState(false);
  const incidents = (data?.incidents || [])
    .filter(
      (i) =>
        !i.demo &&
        i.verification !== "rejected" &&
        (region === "All districts" || i.district === region) &&
        (!reviewedOnly || i.verification === "verified"),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);
  return (
    <section className="public-reports">
      <div className="panel-heading">
        <h2>
          <T text="Public community reports" />
        </h2>
        <select
          aria-label="Public report review status"
          value={reviewedOnly ? "reviewed" : "all"}
          onChange={(e) => setReviewedOnly(e.target.value === "reviewed")}
        >
          <option value="all">
            <T text="All public reports" />
          </option>
          <option value="reviewed">
            <T text="Human reviewed" />
          </option>
        </select>
      </div>
      <p className="small">
        Original community observations. Human-reviewed reports carry a verification badge; other
        reports still need checking. Evidence photos remain private.
      </p>
      <div className="public-report-grid">
        {incidents.map((incident) => (
          <article className="panel padded" key={incident.id}>
            <div className="public-report-top">
              <HazardIcon hazard={incident.hazard} size={25} />
              <VerificationBadge value={incident.verification} />
            </div>
            <h3>{incident.locationName}</h3>
            <p>{incident.district}</p>
            <p className="report-excerpt">{incident.reports[0]?.description.slice(0, 230)}</p>
            <time dateTime={incident.createdAt}>{dateTime(incident.createdAt)}</time>
            <Link className="text-link" href={`/incidents/${incident.id}`}>
              <T text="Read report" /> →
            </Link>
          </article>
        ))}
      </div>
      {!incidents.length && (
        <div className="empty-state">
          <T text="No public reports match this view yet." />
        </div>
      )}
      <Link className="text-link" href="/incidents">
        <T text="View all incidents" /> →
      </Link>
    </section>
  );
}
