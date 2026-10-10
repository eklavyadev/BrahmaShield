"use client";
import { Translated as T } from "./language";

import { useState } from "react";
import { useApp } from "./provider";
import { DataGate, IncidentTable, PageTitle } from "./ui";
import { IncidentMap } from "./maps/map";
import { hazards, label } from "@/lib/domain";
export function MapPage() {
  const { data, region } = useApp();
  const [hazard, setHazard] = useState("all");
  const [verified, setVerified] = useState("all");
  const incidents =
    data?.incidents.filter(
      (item) =>
        (region === "All districts" || item.district === region) &&
        (hazard === "all" || item.hazard === hazard) &&
        (verified === "all" || item.verification === verified) &&
        item.verification !== "rejected",
    ) || [];
  return (
    <>
      <PageTitle
        eyebrow="GEOSPATIAL AWARENESS"
        title="Regional risk map"
        description="Reported conditions and demo resources. No forecast risk model or safe routes are provided."
      />
      <DataGate>
        <div className="filter-bar">
          <label>
            Hazard
            <select value={hazard} onChange={(event) => setHazard(event.target.value)}>
              <option value="all">All hazards</option>
              {hazards.map((item) => (
                <option key={item} value={item}>
                  {label(item)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {" "}
            <T text={"Verification"} />{" "}
            <select value={verified} onChange={(event) => setVerified(event.target.value)}>
              <option value="all">All report statuses</option>
              <option value="verified">
                {" "}
                <T text={"Human reviewed"} />{" "}
              </option>
              <option value="unverified">
                {" "}
                <T text={"Unverified"} />{" "}
              </option>
              <option value="under_review">Under review</option>
            </select>
          </label>
          <span className="muted small">{incidents.length} mapped records</span>
        </div>
        <section className="panel">
          <IncidentMap
            incidents={incidents}
            shelters={data?.shelters.filter(
              (item) => region === "All districts" || item.district === region,
            )}
            height={550}
          />
        </section>
        <div className="notice map-page-note">
          Solid markers indicate human-reviewed records; demo markers retain their DEMO label.
          Dashed markers are unverified. Official warning polygons, landslide susceptibility zones,
          hospitals, and road-closure layers await sourced datasets.
        </div>
        <section className="panel">
          <div className="panel-heading">
            <h2>Accessible map list</h2>
            <span className="small muted">Available even when tiles cannot load</span>
          </div>
          <IncidentTable incidents={incidents} />
        </section>
      </DataGate>
    </>
  );
}
