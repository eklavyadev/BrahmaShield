"use client";
import { useState } from "react";
import Link from "next/link";
import { Search, SlidersHorizontal, Plus, Download } from "lucide-react";
import { hazards, priorities, responseStates, verificationStates, label } from "@/lib/domain";
import { useApp } from "./provider";
import { DataGate, IncidentTable, PageTitle } from "./ui";
export function IncidentsPage({ initialReview = false }: { initialReview?: boolean }) {
  const { data, region } = useApp();
  const [search, setSearch] = useState("");
  const [hazard, setHazard] = useState("all");
  const [verification, setVerification] = useState(initialReview ? "pending" : "all");
  const [priority, setPriority] = useState("all");
  const [response, setResponse] = useState("all");
  const incidents =
    data?.incidents.filter(
      (item) =>
        (region === "All districts" || item.district === region) &&
        (hazard === "all" || item.hazard === hazard) &&
        (priority === "all" || item.priority === priority) &&
        (response === "all" || item.response === response) &&
        (verification === "all" ||
          (verification === "pending"
            ? ["unverified", "under_review"].includes(item.verification)
            : item.verification === verification)) &&
        `${item.id} ${item.title} ${item.district} ${item.locationName}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    ) || [];
  function exportCsv() {
    const escape = (value: string) => `"${value.replaceAll('"', '""').replace(/^[=+@-]/, "'$&")}"`;
    const lines = [
      [
        "id",
        "title",
        "district",
        "hazard",
        "priority",
        "verification",
        "response",
        "demo",
        "observed_at",
      ],
      ...incidents.map((item) => [
        item.id,
        item.title,
        item.district,
        item.hazard,
        item.priority,
        item.verification,
        item.response,
        String(item.demo),
        item.reports[0].observedAt,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob([lines.map((row) => row.map(escape).join(",")).join("\r\n")], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "brahmashield-incidents.csv";
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <PageTitle
        eyebrow="COMMUNITY REPORTS & FIELD OBSERVATIONS"
        title="Incident management"
        description="Review information, trace decisions, and follow every incident through its response."
      >
        <button className="button" onClick={exportCsv} disabled={!incidents.length}>
          <Download size={15} />
          Export CSV
        </button>
        <Link href="/report" className="button primary">
          <Plus size={16} />
          New report
        </Link>
      </PageTitle>
      <DataGate>
        <div className="filter-bar incident-filters">
          <label className="search-field">
            <Search size={16} />
            <input
              aria-label="Search incidents"
              placeholder="Search incident, place, or ID…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          {[
            { name: "Hazard", value: hazard, set: setHazard, options: hazards },
            {
              name: "Verification",
              value: verification,
              set: setVerification,
              options: ["pending", ...verificationStates],
            },
            { name: "Priority", value: priority, set: setPriority, options: priorities },
            { name: "Response", value: response, set: setResponse, options: responseStates },
          ].map((filter) => (
            <label key={filter.name}>
              <span className="sr-only">{filter.name}</span>
              <select value={filter.value} onChange={(event) => filter.set(event.target.value)}>
                <option value="all">All {filter.name.toLowerCase()}</option>
                {filter.options.map((option) => (
                  <option key={option} value={option}>
                    {label(option)}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <button
            className="icon-button"
            title="Reset filters"
            aria-label="Reset incident filters"
            onClick={() => {
              setSearch("");
              setHazard("all");
              setVerification("all");
              setPriority("all");
              setResponse("all");
            }}
          >
            <SlidersHorizontal size={17} />
          </button>
        </div>
        <section className="panel">
          <div className="panel-heading">
            <h2>
              Incident register <span className="count-chip">{incidents.length}</span>
            </h2>
            <span className="small muted">
              Shared persistent records · includes labelled demo data
            </span>
          </div>
          <IncidentTable incidents={incidents} />
        </section>
      </DataGate>
    </>
  );
}
