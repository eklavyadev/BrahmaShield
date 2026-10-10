"use client";
import Link from "next/link";
import { useApp } from "./provider";
import { DataGate, PageTitle, dateTime } from "./ui";
import { IncidentMap } from "./maps/map";
import { districtNames } from "@/lib/domain";
import { Translated as T } from "./language";
export function SafetyPage() {
  const { data, region, setRegion, lastSynced, error } = useApp();
  const active =
    data?.incidents.filter(
      (i) =>
        !i.demo && i.verification !== "rejected" && !["closed", "resolved"].includes(i.response),
    ) || [];
  const districts = districtNames
    .slice(1)
    .filter((d) => region === "All districts" || d === region);
  return (
    <>
      <PageTitle
        title="Safety & area conditions"
        description="Check reported conditions before travelling. No area is certified safe by this app."
      />
      <div className="notice warning">
        <T
          text={
            "No authority-confirmed unaffected areas are currently available. Missing reports, outdated data and inaccessible communities can hide hazards. This map does not provide safe routes."
          }
        />
      </div>
      <DataGate>
        <div className="safety-grid">
          {districts.map((district) => {
            const count = active.filter((i) => i.district === district).length;
            const advisories =
              data?.alerts.filter(
                (a) =>
                  a.district === district &&
                  Date.parse(a.expiresAt) > Date.parse(lastSynced || "1970-01-01"),
              ) || [];
            return (
              <article className="panel padded" key={district}>
                <h2>{district}</h2>
                <span className={`badge ${count ? "priority-high" : "neutral"}`}>
                  <T
                    text={
                      error
                        ? "Information unavailable"
                        : count
                          ? "Reported impact"
                          : "No current public reports"
                    }
                  />
                </span>
                <p>
                  {count} active public reports · {advisories.length} forecast advisories
                </p>
                <p className="small">
                  <T text="Check with district authorities before choosing a destination or route." />
                </p>
                {lastSynced && (
                  <p className="small">
                    <T text="Updated" /> {dateTime(lastSynced)}
                  </p>
                )}
                <Link href="/incidents" onClick={() => setRegion(district)} className="text-link">
                  <T text="View all incidents" />
                </Link>
              </article>
            );
          })}
        </div>
        <section className="panel safety-map">
          <IncidentMap
            incidents={active.filter((i) => region === "All districts" || i.district === region)}
            height={420}
          />
        </section>
      </DataGate>
      <div className="button-row">
        <Link className="button" href="/public-guidance">
          <T text="Public guidance" />
        </Link>
        <Link className="button primary" href="/emergency">
          <T text="Emergency help" />
        </Link>
      </div>
    </>
  );
}
