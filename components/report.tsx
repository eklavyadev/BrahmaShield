"use client";
import { Translated as T } from "./language";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, LocateFixed, Send, Save, WifiOff } from "lucide-react";
import { useApp } from "./provider";
import { districtNames, hazards, label, onSiteReportSchema, type ReportInput } from "@/lib/domain";
import { prepareEvidence } from "@/lib/report-media";
import { currentReportLocation, nearby } from "@/lib/report-location";
import { clearDraft, readDraft, saveDraft, type ReportDraft } from "@/lib/offline";
import { impactLabels } from "@/lib/impact";
import { useLanguage } from "./language";

const initial: ReportDraft = {
  clientId: "",
  hazard: "flood",
  description: "",
  district: "Dibrugarh",
  locationName: "",
  lat: 27.47,
  lng: 94.91,
  observedAt: "",
  language: "en",
  declaration: false,
  publicPhotoConsent: false,
  locationMethod: "gps",
  gpsAccuracyM: null,
  observationSource: "first_hand",
  impactLevel: 2,
  website: "",
};
type Draft = ReportDraft;
export function ReportPage() {
  const { t } = useLanguage();
  const { online, refresh } = useApp();
  const [form, setForm] = useState<ReportDraft>(initial);
  const [hydrated, setHydrated] = useState(false);
  const [confirmedLocation, setConfirmedLocation] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [geolocating, setGeolocating] = useState(false);
  const [result, setResult] = useState("");
  const [queued, setQueued] = useState<ReportInput | null>(null);
  const attempt = useRef(false);
  const [imageName, setImageName] = useState("");
  const [imageBusy, setImageBusy] = useState(false);
  useEffect(() => {
    readDraft()
      .then((saved) => {
        if (saved) {
          setForm({ ...initial, ...saved });
          setConfirmedLocation(false);
          setNotice("A saved draft was restored from this device.");
          if (saved.pending) {
            const parsed = onSiteReportSchema.safeParse(saved);
            if (parsed.success) {
              setQueued(parsed.data);
              setConfirmedLocation(true);
            } else
              setError(
                "Refresh your device GPS and attach a photo before submitting this saved draft.",
              );
          }
        } else
          setForm({
            ...initial,
            clientId: crypto.randomUUID(),
            observedAt: new Date().toISOString(),
          });
      })
      .catch(() => {
        setForm({
          ...initial,
          clientId: crypto.randomUUID(),
          observedAt: new Date().toISOString(),
        });
        setNotice(
          "Device draft storage is unavailable. Keep this page open until submission is confirmed.",
        );
      })
      .finally(() => setHydrated(true));
  }, []);
  useEffect(() => {
    if (!hydrated || result || queued) return;
    const timer = setTimeout(() => {
      if (form.description || form.locationName)
        saveDraft(form).catch(() => setNotice("Automatic draft saving is unavailable."));
    }, 600);
    return () => clearTimeout(timer);
  }, [form, hydrated, result, queued]);
  const deliver = useCallback(
    async (payload: ReportInput) => {
      setBusy(true);
      setError("");
      try {
        if (!payload.gpsCapturedAt || Date.now() - Date.parse(payload.gpsCapturedAt) > 60000) {
          const location = await currentReportLocation();
          if (!nearby(location, payload))
            throw new Error(
              "You are no longer near the reported site. This report requires on-site submission; do not return to an unsafe area.",
            );
          payload = { ...payload, ...location };
          setForm((previous) => ({ ...previous, ...location }));
        }
        const intake = await fetch("/api/intake", { cache: "no-store" });
        const challenge = await intake.json();
        if (!intake.ok)
          throw new Error(challenge.error || "Reporting checks are temporarily unavailable.");
        const response = await fetch("/api/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Intake-Token": challenge.token },
          body: JSON.stringify(payload),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Submission was not accepted.");
        setResult(body.id);
        setQueued(null);
        await clearDraft().catch(() => {});
        await refresh();
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Connection failed. Your report has not been confirmed as received.",
        );
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );
  useEffect(() => {
    if (!online) {
      attempt.current = false;
      return;
    }
    if (queued && !attempt.current) {
      attempt.current = true;
      void deliver(queued);
    }
  }, [online, queued, deliver]);
  function update<K extends keyof ReportDraft>(key: K, value: ReportDraft[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!confirmedLocation) {
      setError("Use your device GPS at the site before reporting.");
      return;
    }
    const parsed = onSiteReportSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    try {
      await saveDraft({ ...parsed.data, pending: true } as Draft);
    } catch {
      if (!online) {
        setError("Offline storage is unavailable. The report cannot be queued on this device.");
        return;
      }
    }
    attempt.current = online;
    setQueued(parsed.data);
    if (online) await deliver(parsed.data);
    else
      setNotice(
        "Pending upload. Your report is saved on this device and will retry when this page reconnects. It has not been delivered.",
      );
  }
  async function upload(file?: File) {
    if (!file) return;
    setImageBusy(true);
    try {
      const encoded = await prepareEvidence(file);
      update("imageData", encoded);
      setImageName(file.name);
      setError("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to read the image.");
    } finally {
      setImageBusy(false);
    }
  }
  async function geolocate() {
    setGeolocating(true);
    setError("");
    setConfirmedLocation(false);
    try {
      const location = await currentReportLocation();
      setForm((previous) => ({ ...previous, ...location }));
      setConfirmedLocation(true);
      setNotice("Current GPS location detected.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Device GPS is unavailable.");
    } finally {
      setGeolocating(false);
    }
  }
  if (result)
    return (
      <div className="submission-success panel">
        <CheckCircle2 size={48} className="teal" />
        <div className="eyebrow">REPORT RECEIVED</div>
        <h1>Your observation is on the record.</h1>
        <p>
          Report <strong>{result}</strong> was saved and is awaiting review. AI interpretation runs
          separately. Possible duplicates or spam are held for human triage before appearing in
          other observers’ views. No emergency service has been contacted.
        </p>
        <div className="button-row">
          <Link className="button primary" href={`/incidents/${result}`}>
            Track this incident
          </Link>
          <Link className="button" href="/map">
            View shared map
          </Link>
        </div>
      </div>
    );
  return (
    <div className="minimal-report">
      <form className="panel report-form" onSubmit={submit}>
        <header className="minimal-report-heading">
          <h1>
            {" "}
            <T text={"Report a hazard"} />{" "}
          </h1>
          <p>
            {" "}
            <T text={"Report from the site. Photo and current GPS are required."} />{" "}
          </p>
        </header>
        <div className="form-body">
          {!online && (
            <div className="notice warning">
              <WifiOff size={15} />
              Offline · saved reports wait for upload.
            </div>
          )}
          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
          {queued && (
            <div className="notice warning">
              Pending upload.
              <div className="button-row">
                <button
                  type="button"
                  className="button small-button"
                  disabled={busy || !online}
                  onClick={() => void deliver(queued)}
                >
                  Retry upload
                </button>
                <button
                  type="button"
                  className="text-link"
                  disabled={busy}
                  onClick={() => {
                    setQueued(null);
                    attempt.current = false;
                    void saveDraft(form);
                  }}
                >
                  Edit draft
                </button>
              </div>
            </div>
          )}
          <fieldset disabled={busy || imageBusy || !!queued}>
            <label>
              {" "}
              <T text={"Photo *"} />{" "}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                aria-label="Hazard photo"
                required={!form.imageData}
                onChange={(event) => void upload(event.target.files?.[0])}
              />
              <small>JPEG, PNG or WebP · up to 10 MB</small>
            </label>
            {imageBusy && <p role="status">Preparing photo…</p>}
            {form.imageData && (
              <div className="minimal-photo">
                <Image
                  className="evidence-preview"
                  src={form.imageData}
                  alt="Attached hazard evidence preview"
                  width={600}
                  height={150}
                  unoptimized
                />
                <div className="field-hint">
                  <span>{imageName || "Saved photo"}</span>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => {
                      update("imageData", undefined);
                      setImageName("");
                    }}
                  >
                    {" "}
                    <T text={"Remove photo"} />{" "}
                  </button>
                </div>
              </div>
            )}
            <div className="minimal-gps" aria-live="polite">
              <div>
                <strong>
                  {" "}
                  <T text={"Device location *"} />{" "}
                </strong>
                <p>
                  {confirmedLocation
                    ? `GPS detected · accuracy ±${Math.round(form.gpsAccuracyM || 0)} m`
                    : "Not detected yet"}
                </p>
              </div>
              <button
                type="button"
                className="button small-button"
                disabled={geolocating}
                onClick={() => void geolocate()}
              >
                <LocateFixed size={14} />
                {geolocating ? "Detecting…" : confirmedLocation ? "Refresh GPS" : "Detect GPS"}
              </button>
            </div>
            <div className="two-columns">
              <label>
                {" "}
                <T text={"Hazard type *"} />{" "}
                <select
                  value={form.hazard}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      hazard: event.target.value as ReportInput["hazard"],
                      impactLevel: 2,
                    }))
                  }
                >
                  {hazards.map((hazard) => (
                    <option key={hazard} value={hazard}>
                      {t(label(hazard))}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {" "}
                <T text={"Severity level *"} />{" "}
                <select
                  aria-label="Severity level"
                  value={form.impactLevel}
                  onChange={(event) =>
                    update("impactLevel", Number(event.target.value) as 1 | 2 | 3)
                  }
                >
                  {impactLabels[form.hazard].map((description, index) => (
                    <option key={description} value={index + 1}>
                      {t(["Low", "Moderate", "Severe"][index])}
                    </option>
                  ))}
                </select>
                <small>{impactLabels[form.hazard][form.impactLevel - 1]}</small>
              </label>
            </div>
            <label>
              {" "}
              <T text={"Description *"} />{" "}
              <textarea
                required
                minLength={15}
                maxLength={4000}
                rows={3}
                placeholder={t(
                  "What happened? Describe what you can see. Any local language is welcome.",
                )}
                value={form.description}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    description: event.target.value,
                    language: /[\u0980-\u09ff]/.test(event.target.value) ? "mixed" : "en",
                  }))
                }
              />
            </label>
            <div className="two-columns">
              <label>
                {" "}
                <T text={"District *"} />{" "}
                <select
                  value={form.district}
                  onChange={(event) => update("district", event.target.value)}
                >
                  {districtNames.slice(1).map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              </label>
              <label>
                {" "}
                <T text={"Nearest landmark *"} />{" "}
                <input
                  required
                  minLength={3}
                  maxLength={160}
                  placeholder="e.g. Near the village bridge"
                  value={form.locationName}
                  onChange={(event) => update("locationName", event.target.value)}
                />
              </label>
            </div>
            <label className="report-declaration">
              <input
                type="checkbox"
                checked={form.declaration}
                onChange={(event) => update("declaration", event.target.checked)}
              />
              <span>
                <T
                  text={
                    "I’m at this site and my report is truthful. I consent to storing my photo, GPS and description for review. Text and location may be public. My photo stays private unless I choose to share it below."
                  }
                />
              </span>
            </label>
            <label className="report-declaration">
              <input
                type="checkbox"
                checked={form.publicPhotoConsent === true}
                onChange={(event) => update("publicPhotoConsent", event.target.checked)}
              />
              <span>
                <T text="Show my photo publicly with this report (optional). Avoid faces, private documents and other identifying details. Reports held for review stay private until verified." />
              </span>
            </label>
            <div className="honeypot" aria-hidden="true">
              <label>
                Website
                <input
                  tabIndex={-1}
                  autoComplete="off"
                  value={form.website}
                  onChange={(event) => update("website", event.target.value)}
                />
              </label>
            </div>
          </fieldset>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-footer">
            <button
              type="button"
              className="button"
              disabled={busy || imageBusy || !hydrated}
              onClick={() =>
                void saveDraft(form)
                  .then(() => setNotice("Draft saved on this device."))
                  .catch(() => setError("Unable to save draft."))
              }
            >
              <Save size={14} /> <T text={"Save draft"} />{" "}
            </button>
            <button
              className="button primary"
              disabled={
                busy ||
                imageBusy ||
                geolocating ||
                !hydrated ||
                !!queued ||
                !form.declaration ||
                !confirmedLocation ||
                !form.imageData
              }
            >
              <Send size={14} />
              {busy ? "Sending…" : online ? "Submit report" : "Save for upload"}
            </button>
          </div>
          <p className="minimal-safety">
            {" "}
            <T
              text={"Do not enter danger to report. This app does not contact emergency services."}
            />{" "}
          </p>
        </div>
      </form>
    </div>
  );
}
