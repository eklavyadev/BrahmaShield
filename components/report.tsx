"use client";
import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  LocateFixed,
  MapPin,
  Upload,
  Send,
  Save,
  WifiOff,
  Info,
  Languages,
} from "lucide-react";
import { useApp } from "./provider";
import { PageTitle } from "./ui";
import { IncidentMap } from "./maps/map";
import { districtNames, hazards, label, reportSchema, type ReportInput } from "@/lib/domain";
import { clearDraft, readDraft, saveDraft, type ReportDraft } from "@/lib/offline";
import { impactLabels } from "@/lib/impact";

const sample = "নাওবৈচাৰ পথত পানী উঠিছে। কেইজনমান লোক পথৰ সিপাৰে আবদ্ধ হৈ আছে।";
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
  locationMethod: "manual",
  gpsAccuracyM: null,
  observationSource: "first_hand",
  impactLevel: 2,
  website: "",
};
type Draft = ReportDraft;
export function ReportPage() {
  const { online, refresh } = useApp();
  const [form, setForm] = useState<ReportDraft>(initial);
  const [hydrated, setHydrated] = useState(false);
  const [confirmedLocation, setConfirmedLocation] = useState(false);
  const [language, setLanguage] = useState("en");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [geolocating, setGeolocating] = useState(false);
  const [result, setResult] = useState("");
  const [queued, setQueued] = useState<ReportInput | null>(null);
  const attempt = useRef(false);
  const [imageName, setImageName] = useState("");
  useEffect(() => {
    readDraft()
      .then((saved) => {
        if (saved) {
          setForm({ ...initial, ...saved });
          setConfirmedLocation(saved.pending === true);
          setNotice("A saved draft was restored from this device.");
          if (saved.pending) {
            const parsed = reportSchema.safeParse(saved);
            if (parsed.success) setQueued(parsed.data);
            else
              setError(
                "Saved draft needs the new declaration and report-quality fields before upload.",
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
      setError("Please confirm the location using the map, geolocation, or coordinate fields.");
      return;
    }
    const parsed = reportSchema.safeParse(form);
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
    if (!["image/png", "image/jpeg"].includes(file.type) || file.size > 5000000) {
      setError("Choose a PNG or JPEG under 5 MB. Images are resized and stored privately.");
      return;
    }
    try {
      const image = await createImageBitmap(file);
      const scale = Math.min(1, 1200 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Image processing is unavailable.");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      image.close();
      const encoded = canvas.toDataURL("image/jpeg", 0.75);
      if (encoded.length > 1300000)
        throw new Error("Image is still too large. Choose a smaller image.");
      update("imageData", encoded);
      setImageName(file.name);
      setError("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to read the image.");
    }
  }
  function geolocate() {
    if (!navigator.geolocation) {
      setError("Geolocation is unavailable. Select a point on the map or enter coordinates.");
      return;
    }
    setGeolocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setForm((previous) => ({
          ...previous,
          lat: Number(latitude.toFixed(5)),
          lng: Number(longitude.toFixed(5)),
          locationMethod: "gps",
          gpsAccuracyM: Math.round(accuracy),
        }));
        setConfirmedLocation(false);
        setGeolocating(false);
        setNotice(
          accuracy > 200
            ? "GPS uncertainty exceeds 200 metres. Confirm the point on the map or enter the hazard location manually. Do not move into danger to improve GPS reception."
            : "Device location selected. Check that it matches the hazard location, rather than only your current position.",
        );
      },
      () => {
        setGeolocating(false);
        setError(
          "Location permission denied or unavailable. Use the map or coordinate fields instead.",
        );
      },
      { timeout: 10000, enableHighAccuracy: true },
    );
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
  const as = language === "as";
  return (
    <>
      <PageTitle
        eyebrow="COMMUNITY INTELLIGENCE"
        title={as ? "বিপদৰ খবৰ দিয়ক" : "Report a local hazard"}
        description={
          as
            ? "আপুনি দেখা পৰিস্থিতিৰ খবৰ দিয়ক। তথ্যসমূহ পৰ্যালোচনা কৰা হ’ব।"
            : "Share what you observed. Local knowledge helps responders understand changing conditions."
        }
      >
        <label className="language-control">
          <Languages size={16} />
          <select
            aria-label="Interface language"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            <option value="en">English</option>
            <option value="as">অসমীয়া</option>
          </select>
        </label>
      </PageTitle>
      <div className="report-layout">
        <form className="panel report-form" onSubmit={submit}>
          <div className="panel-heading">
            <h2>Observation details</h2>
            <span className="small muted">* Required</span>
          </div>
          <div className="form-body">
            {!online && (
              <div className="notice warning">
                <WifiOff size={16} />
                Offline · reports stay on this device until delivery is confirmed.
              </div>
            )}
            {notice && <div className="notice">{notice}</div>}
            {queued && (
              <div className="notice warning">
                Pending server confirmation. Keep this page open to retry.
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
                    onClick={() => {
                      setQueued(null);
                      attempt.current = false;
                      void saveDraft(form);
                    }}
                  >
                    Edit saved draft
                  </button>
                </div>
              </div>
            )}
            <fieldset disabled={busy || !!queued}>
              <div className="two-columns">
                <label>
                  {as ? "বিপদৰ ধৰণ" : "Hazard type"} *
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
                        {label(hazard)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {as ? "খবৰৰ ভাষা" : "Report language"}
                  <select
                    value={form.language}
                    onChange={(event) =>
                      update("language", event.target.value as ReportInput["language"])
                    }
                  >
                    <option value="en">English</option>
                    <option value="as">Assamese / অসমীয়া</option>
                    <option value="mixed">Mixed / transliterated</option>
                  </select>
                </label>
              </div>
              <div className="two-columns">
                <label>
                  Reported impact
                  <select
                    value={form.impactLevel}
                    onChange={(event) =>
                      update("impactLevel", Number(event.target.value) as 1 | 2 | 3)
                    }
                  >
                    {impactLabels[form.hazard].map((description, index) => (
                      <option value={index + 1} key={description}>
                        {index + 1} · {description}
                      </option>
                    ))}
                  </select>
                  <small>Your assessment; responder priority is decided separately.</small>
                </label>
                <label>
                  Observation source
                  <select
                    value={form.observationSource}
                    onChange={(event) =>
                      update(
                        "observationSource",
                        event.target.value as "first_hand" | "second_hand",
                      )
                    }
                  >
                    <option value="first_hand">I observed this directly</option>
                    <option value="second_hand">Someone else reported it to me</option>
                  </select>
                </label>
              </div>
              <label>
                {as ? "আপুনি কি দেখিছে?" : "What did you observe?"} *
                <textarea
                  required
                  minLength={15}
                  maxLength={4000}
                  rows={5}
                  placeholder={
                    as
                      ? "ঘটনাটোৰ বিষয়ে বৰ্ণনা কৰক…"
                      : "Describe the conditions, observed impact, and anything responders should check. Avoid names, phone numbers, or private details."
                  }
                  value={form.description}
                  onChange={(event) => update("description", event.target.value)}
                />
              </label>
              <div className="field-hint">
                <span>{form.description.length} / 4000 characters</span>
                <button
                  type="button"
                  className="text-link"
                  onClick={() => {
                    setForm((previous) => ({
                      ...previous,
                      description: sample,
                      language: "as",
                      district: "Lakhimpur",
                      locationName: "Naoboicha approach road",
                      lat: 27.16,
                      lng: 94.09,
                      locationMethod: "manual",
                      gpsAccuracyM: null,
                    }));
                    setConfirmedLocation(true);
                  }}
                >
                  Try Assamese example
                </button>
              </div>
              <div className="two-columns">
                <label>
                  {as ? "জিলা" : "District"} *
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
                  {as ? "স্থানৰ নাম" : "Place / landmark"} *
                  <input
                    required
                    minLength={3}
                    maxLength={160}
                    placeholder="Village, road, or landmark"
                    value={form.locationName}
                    onChange={(event) => update("locationName", event.target.value)}
                  />
                </label>
              </div>
              <label>
                {as ? "ঘটনাৰ সময়" : "When did you observe this?"} *
                <input
                  type="datetime-local"
                  required
                  value={
                    form.observedAt
                      ? new Date(Date.parse(form.observedAt) + 330 * 60000)
                          .toISOString()
                          .slice(0, 16)
                      : ""
                  }
                  onChange={(event) => {
                    if (event.target.value)
                      update(
                        "observedAt",
                        new Date(`${event.target.value}:00+05:30`).toISOString(),
                      );
                  }}
                />
                <small>Time is entered in India Standard Time.</small>
              </label>
              <div className="location-heading">
                <h3>
                  <MapPin size={16} />
                  Report location *
                </h3>
                <button
                  type="button"
                  className="button small-button"
                  onClick={geolocate}
                  disabled={geolocating}
                >
                  {geolocating ? (
                    "Locating…"
                  ) : (
                    <>
                      <LocateFixed size={14} />
                      Use my location
                    </>
                  )}
                </button>
              </div>
              <IncidentMap
                incidents={[]}
                height={250}
                selected={[form.lat, form.lng]}
                picker={(lat, lng) => {
                  setForm((previous) => ({
                    ...previous,
                    lat,
                    lng,
                    locationMethod: "map",
                    gpsAccuracyM: null,
                  }));
                  setConfirmedLocation(true);
                }}
              />
              <p className="small muted location-quality">
                Location source: {label(form.locationMethod)}
                {form.gpsAccuracyM !== null
                  ? ` · GPS uncertainty ±${form.gpsAccuracyM} metres (device-reported)`
                  : " · accuracy not measured"}
              </p>
              <div className="two-columns coordinate-fields">
                <label>
                  Latitude
                  <input
                    type="number"
                    required
                    step="any"
                    min={20}
                    max={30}
                    value={form.lat}
                    onChange={(event) => {
                      setForm((previous) => ({
                        ...previous,
                        lat: Number(event.target.value),
                        locationMethod: "manual",
                        gpsAccuracyM: null,
                      }));
                      setConfirmedLocation(true);
                    }}
                  />
                </label>
                <label>
                  Longitude
                  <input
                    type="number"
                    required
                    step="any"
                    min={88}
                    max={98}
                    value={form.lng}
                    onChange={(event) => {
                      setForm((previous) => ({
                        ...previous,
                        lng: Number(event.target.value),
                        locationMethod: "manual",
                        gpsAccuracyM: null,
                      }));
                      setConfirmedLocation(true);
                    }}
                  />
                </label>
              </div>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={confirmedLocation}
                  onChange={(event) => setConfirmedLocation(event.target.checked)}
                />
                I have checked that this point matches the reported location.
              </label>
              <label className="upload-field">
                <Upload size={20} />
                <strong>
                  {imageName || (form.imageData ? "Saved image attached" : "Add an optional photo")}
                </strong>
                <small>PNG or JPEG · up to 5 MB · resized and metadata removed</small>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  capture="environment"
                  onChange={(event) => void upload(event.target.files?.[0])}
                />
              </label>
              {form.imageData && (
                <Image
                  className="evidence-preview"
                  src={form.imageData}
                  alt="Attached hazard evidence preview"
                  width={600}
                  height={220}
                  unoptimized
                />
              )}
              {form.imageData && (
                <button
                  type="button"
                  className="text-link"
                  onClick={() => {
                    update("imageData", undefined);
                    setImageName("");
                  }}
                >
                  Remove attachment
                </button>
              )}
              <label className="report-declaration">
                <input
                  type="checkbox"
                  checked={form.declaration}
                  onChange={(event) => update("declaration", event.target.checked)}
                />
                <span>
                  <strong>I confirm this report is truthful to the best of my knowledge.</strong> I
                  consent to storing the reported location and observations for review and
                  coordination within this prototype. Reports may appear in public views with their
                  verification status; possible spam is held for triage. Photos are responder-only.
                  I have not included private contact or health information. This does not submit a
                  complaint to a government authority.
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
                disabled={busy || !hydrated}
                onClick={() =>
                  void saveDraft(form)
                    .then(() => setNotice("Draft saved on this device. It has not been submitted."))
                    .catch(() => setError("Unable to save the draft."))
                }
              >
                <Save size={15} />
                Save draft
              </button>
              <button
                className="button primary"
                disabled={busy || !hydrated || !!queued || !form.declaration || !confirmedLocation}
              >
                <Send size={15} />
                {busy
                  ? "Sending…"
                  : online
                    ? as
                      ? "খবৰ পঠিয়াওক"
                      : "Submit report"
                    : "Queue offline report"}
              </button>
            </div>
          </div>
        </form>
        <aside className="report-sidebar">
          <section className="panel padded">
            <Info className="teal" />
            <h3>Your words. A clearer picture.</h3>
            <p>
              Gemma can extract location clues and reported impact. The original report stays
              unchanged.
            </p>
            <ol className="process-steps">
              <li>
                <span>1</span>Submit your observation
              </li>
              <li>
                <span>2</span>Interpret with Gemma or demo adapter
              </li>
              <li>
                <span>3</span>Human review and prioritisation
              </li>
              <li>
                <span>4</span>Track the response status
              </li>
            </ol>
          </section>
          <section className="panel padded">
            <h3>Before you submit</h3>
            <p>
              Report only what you observed. Do not approach a dangerous area to collect evidence.
            </p>
            <p>
              Describe assistance needs without identifying vulnerable individuals. Attachments are
              visible only to signed-in responders.
            </p>
            <p className="small amber">
              This platform does not arrange rescue. Follow official emergency channels and local
              authority instructions.
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
