"use client";
import Link from "next/link";
import { RadioTower, Users, Package, Home, ArrowUpRight, ShieldQuestion } from "lucide-react";
import { useApp } from "./provider";
import { DataGate, IncidentTable, PageTitle, relativeTime } from "./ui";
export function ResponsePage() {
  const { data, region, responder } = useApp();
  const incidents =
    data?.incidents.filter(
      (item) =>
        (region === "All districts" || item.district === region) &&
        !["closed", "resolved"].includes(item.response),
    ) || [];
  const review = incidents.filter((item) =>
    ["unverified", "under_review"].includes(item.verification),
  );
  return (
    <>
      <PageTitle
        eyebrow="SHARED RESPONSE WORKSPACE"
        title="Responder command center"
        description="Prioritise assessments, understand team workload, and coordinate incident response."
      >
        <span className="badge neutral">
          <RadioTower size={14} />
          {responder ? "Responder access" : "Read-only observer"}
        </span>
      </PageTitle>
      <DataGate>
        <div className="notice warning">
          Teams, inventories, and shelters below are demo records. Assignments are internal tracking
          actions; no dispatch or external notification is sent.
        </div>
        <div className="three-columns team-grid">
          {data?.teams
            .filter((item) => region === "All districts" || item.district === region)
            .map((team) => {
              const assignments = incidents.filter((item) => item.assignedTeamId === team.id);
              return (
                <article className="panel padded team-card" key={team.id}>
                  <div className="team-top">
                    <span className="hazard-tile hazard-waterlogging">
                      <Users size={20} />
                    </span>
                    <span className="demo-inline">DEMO TEAM</span>
                  </div>
                  <h3>{team.name}</h3>
                  <p>{team.capability}</p>
                  <div className="team-info">
                    <span>{team.district}</span>
                    <span>{team.members} members</span>
                  </div>
                  <div className="team-workload">
                    <strong>{assignments.length}</strong>
                    <span>active assignments in this view</span>
                  </div>
                  <div className="small muted">Roster checked {relativeTime(team.checkedAt)}</div>
                  {assignments.map((item) => (
                    <Link href={`/incidents/${item.id}`} className="team-assignment" key={item.id}>
                      {item.id} · {item.locationName}
                      <ArrowUpRight size={13} />
                    </Link>
                  ))}
                </article>
              );
            })}
        </div>
        <section className="panel response-section">
          <div className="panel-heading">
            <h2>
              <ShieldQuestion className="amber" size={16} />
              Assessment & spam-review queue
            </h2>
            <span className="small muted">Urgent unverified reports remain visible</span>
          </div>
          <IncidentTable
            incidents={[...review].sort(
              (a, b) =>
                ["critical", "high", "medium", "low"].indexOf(a.priority) -
                ["critical", "high", "medium", "low"].indexOf(b.priority),
            )}
          />
        </section>
        <section className="panel response-section">
          <div className="panel-heading">
            <h2>Active response incidents</h2>
            <Link href="/incidents" className="text-link">
              Open register <ArrowUpRight size={14} />
            </Link>
          </div>
          <IncidentTable
            incidents={incidents.filter((item) =>
              ["assigned", "in_progress"].includes(item.response),
            )}
          />
        </section>
        <div className="two-columns resource-layout">
          <section className="panel response-section">
            <div className="panel-heading">
              <h2>
                <Home size={16} />
                Demo shelter records
              </h2>
              <span className="small muted">Access needs confirmation</span>
            </div>
            <div className="resource-list">
              {data?.shelters
                .filter((item) => region === "All districts" || item.district === region)
                .map((shelter) => (
                  <article key={shelter.id}>
                    <div>
                      <strong>{shelter.name}</strong>
                      <small>
                        {shelter.district} · DEMO · checked {relativeTime(shelter.checkedAt)}
                      </small>
                    </div>
                    <div className="capacity-meter">
                      <span>
                        {shelter.occupied} / {shelter.capacity} demo occupancy
                      </span>
                      <progress max={shelter.capacity} value={shelter.occupied} />
                      <small>
                        {shelter.accessible
                          ? "Demo accessibility recorded"
                          : "Accessibility not confirmed"}
                      </small>
                    </div>
                  </article>
                ))}
            </div>
          </section>
          <section className="panel response-section">
            <div className="panel-heading">
              <h2>
                <Package size={16} />
                Demo relief inventory
              </h2>
              <span className="demo-inline">SIMULATED</span>
            </div>
            <div className="resource-list">
              {data?.resources
                .filter(
                  (resource) =>
                    region === "All districts" ||
                    data.teams.find((team) => team.id === resource.teamId)?.district === region,
                )
                .map((resource) => (
                  <article key={resource.id}>
                    <div>
                      <strong>{resource.name}</strong>
                      <small>{data.teams.find((team) => team.id === resource.teamId)?.name}</small>
                      <small>Checked {relativeTime(resource.checkedAt)} · DEMO</small>
                    </div>
                    <span className="resource-quantity">
                      {resource.quantity}
                      <small>{resource.unit}</small>
                    </span>
                  </article>
                ))}
            </div>
          </section>
        </div>
      </DataGate>
    </>
  );
}
