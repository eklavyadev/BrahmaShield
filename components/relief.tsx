"use client";
import { useState } from "react";
import { ExternalLink, Tent, Utensils, Landmark } from "lucide-react";
import { useApp } from "./provider";
import { DataGate, PageTitle, dateTime } from "./ui";
import { districtNames, type ReliefUpdate, type ReliefUpdateInput } from "@/lib/domain";
import { Translated as T } from "./language";
const categories = [
  { value: "camp", label: "Relief camps", icon: Tent },
  { value: "food", label: "Food distribution", icon: Utensils },
  { value: "initiative", label: "Government assistance", icon: Landmark },
] as const;
type Draft = Omit<ReliefUpdateInput, "id" | "expectedRevision" | "validUntil"> & {
  id?: string;
  expectedRevision: number;
  validUntil: string;
};
function newDraft(): Draft {
  return {
    kind: "camp",
    district: "Dibrugarh",
    title: "",
    location: "",
    details: "",
    sourceUrl: "",
    status: "active",
    quantity: null,
    expectedRevision: 0,
    validUntil: "",
  };
}
const officialLinks = [
  {
    title: "Relief camps & food distribution",
    description:
      "Read the latest Assam flood situation report for official camp and relief-distribution updates. Check its issue date before travelling.",
    url: "https://asdma.assam.gov.in/information-services/detail/assam-flood-report",
  },
  {
    title: "Government disaster assistance",
    description:
      "ASDMA's financial-assistance handbook explains disaster relief. Confirm current eligibility, required documents and the application process with your district or revenue-circle office.",
    url: "https://asdma.assam.gov.in/sites/default/files/swf_utility_folder/departments/asdma_revenue_uneecopscloud_com_oid_70/menu/document/financial_assistance_during_disasters_handbook_08_05_2024_1.pdf",
  },
  {
    title: "State disaster management updates",
    description:
      "Official Assam State Disaster Management Authority information and announcements.",
    url: "https://asdma.assam.gov.in/",
  },
];
export function ReliefPage() {
  const { data, region, responder, refresh, lastSynced } = useApp();
  const [kind, setKind] = useState("all");
  const [includePast, setIncludePast] = useState(false);
  const [draft, setDraft] = useState<Draft>(newDraft);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const updates = (data?.reliefUpdates || []).filter(
    (item) =>
      (region === "All districts" || item.district === region) &&
      (kind === "all" || item.kind === kind) &&
      (includePast ||
        (item.status === "active" &&
          Date.parse(item.validUntil) > Date.parse(lastSynced || "1970-01-01"))),
  );
  function edit(item: ReliefUpdate) {
    const local = new Date(item.validUntil);
    local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
    setDraft({
      ...item,
      expectedRevision: item.revision,
      validUntil: local.toISOString().slice(0, 16),
    });
    setMessage("");
  }
  async function publish(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const id = draft.id || crypto.randomUUID();
    setDraft((previous) => ({ ...previous, id }));
    try {
      const response = await fetch("/api/relief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          id,
          validUntil: new Date(draft.validUntil).toISOString(),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setMessage("Relief update published. No booking or dispatch has been made.");
      setDraft(newDraft());
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to publish update.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        title="Relief & support"
        description="Relief camp updates, food distribution and official assistance information."
      />
      <div className="notice">
        <T
          text={
            "Listings are published by authorized responders with a source and expiry time. Availability must be reconfirmed locally; no booking, food allocation or rescue dispatch happens through this page."
          }
        />
      </div>
      <div className="three-columns">
        {officialLinks.map((link) => (
          <article className="panel padded" key={link.url}>
            <h2>{link.title}</h2>
            <p>{link.description}</p>
            <a href={link.url} target="_blank" rel="noreferrer" className="text-link">
              <T text="Source" /> <ExternalLink size={14} />
            </a>
          </article>
        ))}
      </div>
      <DataGate>
        <h2 className="forecast-heading">
          <T text="Latest relief updates" />
        </h2>
        <div className="filter-bar">
          <select
            aria-label="Relief category"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="all">
              <T text={"All support"} />
            </option>
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                <T text={c.label} />
              </option>
            ))}
          </select>
          <label className="inline-check">
            <input
              type="checkbox"
              checked={includePast}
              onChange={(e) => setIncludePast(e.target.checked)}
            />
            Include closed or expired updates
          </label>
        </div>
        <div className="public-report-grid">
          {updates.map((item) => {
            const category = categories.find((c) => c.value === item.kind)!;
            const expired = Date.parse(item.validUntil) <= Date.parse(lastSynced || "1970-01-01");
            return (
              <article className="panel padded relief-card" key={item.id}>
                <div className="public-report-top">
                  <category.icon size={22} />
                  <span className="badge neutral">
                    <T
                      text={expired ? "Expired" : item.status === "closed" ? "Closed" : "Active"}
                    />
                  </span>
                </div>
                <h3>{item.title}</h3>
                <p>
                  {item.district} · {item.location}
                </p>
                <p>{item.details}</p>
                {item.quantity !== null && (
                  <p className="small">
                    {item.kind === "camp"
                      ? "Reported places"
                      : item.kind === "food"
                        ? "Reported servings"
                        : "Reported allocation"}
                    : {item.quantity} · reconfirm availability
                  </p>
                )}
                <p className="small">
                  <T text="Updated" />{" "}
                  <time dateTime={item.updatedAt}>{dateTime(item.updatedAt)}</time>
                </p>
                <p className="small">
                  <T text="Valid until" /> {dateTime(item.validUntil)}
                </p>
                <a className="text-link" href={item.sourceUrl} target="_blank" rel="noreferrer">
                  <T text="Source" />
                  <ExternalLink size={13} />
                </a>
                {responder && (
                  <button className="button small-button" onClick={() => edit(item)}>
                    <T text="Edit update" />
                  </button>
                )}
              </article>
            );
          })}
        </div>
        {!updates.length && (
          <div className="empty-state">
            <T text="No current relief updates have been published for this district." />
            <p>
              Use the official situation report above or call the district control room to confirm
              camp and food-distribution details.
            </p>
          </div>
        )}
      </DataGate>
      {responder && (
        <form className="panel padded relief-editor" onSubmit={(e) => void publish(e)}>
          <h2>
            <T text="Publish relief update" />
          </h2>
          <p>
            Publish public information only. Include the source and distribution schedule. Do not
            enter beneficiary names or private contact information.
          </p>
          <fieldset disabled={busy}>
            <div className="two-columns">
              <label>
                <T text={"Category"} />
                <select
                  value={draft.kind}
                  onChange={(e) => setDraft({ ...draft, kind: e.target.value as Draft["kind"] })}
                >
                  {categories.map((c) => (
                    <option key={c.value} value={c.value}>
                      <T text={c.label} />
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <T text="District" />
                <select
                  value={draft.district}
                  onChange={(e) =>
                    setDraft({ ...draft, district: e.target.value as Draft["district"] })
                  }
                >
                  {districtNames.slice(1).map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              <T text="Title" />
              <input
                required
                minLength={5}
                maxLength={120}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </label>
            <label>
              <T text="Location" />
              <input
                required
                minLength={3}
                maxLength={160}
                value={draft.location}
                onChange={(e) => setDraft({ ...draft, location: e.target.value })}
              />
            </label>
            <label>
              <T text="Details" />
              <textarea
                required
                minLength={15}
                maxLength={2000}
                rows={4}
                value={draft.details}
                onChange={(e) => setDraft({ ...draft, details: e.target.value })}
              />
            </label>
            <label>
              <T text="Source URL" />
              <input
                type="url"
                required
                value={draft.sourceUrl}
                onChange={(e) => setDraft({ ...draft, sourceUrl: e.target.value })}
              />
            </label>
            <div className="two-columns">
              <label>
                <T text="Valid until" />
                <input
                  type="datetime-local"
                  required
                  value={draft.validUntil}
                  onChange={(e) => setDraft({ ...draft, validUntil: e.target.value })}
                />
              </label>
              <label>
                Reported places / servings (optional)
                <input
                  type="number"
                  min={0}
                  max={1000000}
                  value={draft.quantity ?? ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      quantity: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </label>
            </div>
            <label>
              <T text="Status" />
              <select
                value={draft.status}
                onChange={(e) => setDraft({ ...draft, status: e.target.value as Draft["status"] })}
              >
                <option value="active">
                  <T text="Active" />
                </option>
                <option value="closed">
                  <T text="Closed" />
                </option>
              </select>
            </label>
            <div className="button-row">
              <button className="button primary" type="submit">
                <T text="Publish relief update" />
              </button>
              <button type="button" className="button" onClick={() => setDraft(newDraft())}>
                <T text={"Clear editor"} />
              </button>
            </div>
          </fieldset>
        </form>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
    </>
  );
}
