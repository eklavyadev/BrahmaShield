# BrahmaShield

A working Next.js disaster-resilience prototype for Assam and Northeast India. It connects community observations, Gemma interpretation, human evidence review, and tracked responder actions. It is not an official warning system or rescue service.

Supabase persistence, private evidence storage, account/membership authorization, and a continuous local Gemma worker are now implemented. See [cloud setup](docs/supabase.md). `/api/health` distinguishes a connected database from a model that is still downloading.

## Run locally

Requires Node.js **22.20+** (the local repository uses the built-in `node:sqlite` module) and npm.

```sh
npm ci
npm run dev
```

Open http://localhost:3000/dashboard. Public pages need no sign-in. The authority dashboard at `/authority` uses the requested prototype password **1234**; its session is signed and expires after two hours. Data is seeded on first use and persists in `.data/brahmashield.sqlite`; uploads live in `.data/uploads`. Those files are ignored by Git.

Public reports start unverified and medium priority. The responder sign-in dialog and profile button have been removed from the interface at the user's request. Responder mutations and private photos still require backend authorization; removing the dialog does not grant public access. An authorized operator can change priority, verify evidence, assign a team, start a response, and record resolution. Assignments never contact an external team.

## What works

- Landing page, public report cards, situation room, light OSM map, live forecast alerts, community reporting, incident register/detail, response console, Gemma workspace, public guidance, emergency contacts, area conditions, relief updates, and authority dashboard.
- Consistent persisted records across every screen, with 15-second polling and immediate refetch after actions.
- OpenStreetMap raster tiles through Leaflet, OSM attribution, independent hazard/shelter layers, clickable incident popups, zoom, fit-to-records, and accessible list fallback.
- Minimal on-site report form, required fresh device GPS (accuracy within 200 metres), required photo evidence, user-selected Low/Moderate/Severe levels, and a trackable incident ID. The report page contains no map or coordinate inputs. Manual/map coordinates and secondhand submissions are rejected by the public API.
- Roadwatch-inspired reporting: hazard-specific impact, firsthand observations, photo preview, truthful-report declaration, and consent. GPS location cannot be edited in the interface. Browser GPS can be deliberately spoofed; these checks are not hardware proof of presence. Never approach danger to collect evidence or improve reception.
- Server-side intake tokens bound to an anonymous device cookie, a honeypot, and device/network request limits. Matching text/location/time, reused images, repetitive wording, and excessive links flag reports for triage. Possible duplicates remain separate as potential corroboration; neither AI nor spam scoring verifies a report.
- Flagged submissions are visible only to their submitting browser and responders until verified. Their AI jobs are held until a responder starts review. Private image digests and device hashes never appear in API snapshots.
- Images are re-encoded on the client to reduce size and remove metadata; upload magic bytes and size are checked on the server. Photos require responder access.
- Original reports retained separately from AI output. One tested curated Assamese demonstration example; arbitrary reports are explicitly not translated in demo mode.
- Server-enforced verification and response lifecycles, evidence notes, an audit history, and optimistic revision checks that reject stale edits.
- Durable SQLite or Supabase job records, report-first storage, explicit processing/failure states, and operator retry. Jobs run after requests or through `npm run worker`; Supabase jobs use exclusive leases.
- Search, district/hazard/status/priority filters, CSV export, advisory explanations, source links, and derived dashboard charts.
- IndexedDB report drafts and queued submissions. A validated offline report retries when the open reporting page reconnects or is reopened. The interface only shows delivery after the server acknowledges it. Idempotency keys prevent duplicate retry submissions.
- Production-only service worker with cached previously visited report/preparedness pages, local static assets, and an offline fallback. APIs and external OSM tiles are never cached by the service worker.
- Source-grounded public guidance, device-persistent emergency-kit checklist, and optional browser speech using available voices for the selected language.
- English, Assamese and Hindi selectors for core navigation, forms and guidance. Unsupported interface strings fall back to English; report originals and source bulletins retain their original language.
- Timestamped Open-Meteo forecasts for eight representative district centres, with explicitly labelled application advisories and stale/unavailable feed states.
- Opt-in district-filtered browser notifications for new advisories while the app is open.
- Authority incident overrides with reasons, preserved evidence, revision checks and audit history; separate publish/revise/withdraw controls for authority advisories.
- Published relief-camp, food-distribution and assistance updates with source links, validity dates and recorded revisions.
- Responsive layouts, accessible labels, keyboard focus states, and reduced-motion support.

## Gemma configuration

Copy `.env.example` to `.env.local` when configuring integrations. The model adapter uses the **OpenAI-compatible chat-completions protocol** of your chosen Gemma serving runtime; it does not call a Gemini model.

For example, run actual Gemma weights with Ollama locally:

```sh
ollama pull gemma3:4b
ollama serve
```

```dotenv
AI_MODE=live
GEMMA_BASE_URL=http://localhost:11434/v1
GEMMA_MODEL=gemma3:4b
GEMMA_API_KEY=
```

If your serving endpoint requires authentication, set `GEMMA_API_KEY`. Ensure the endpoint supports `response_format: { type: "json_object" }`. Model credentials stay server-side. Your chosen provider receives report text/questions; the interpretation request does not include coordinates, attachments, or contact fields.

With `AI_MODE=demo` (the default), deterministic outputs are clearly labelled. Live mode failures never silently become demo responses. Structured interpretations are validated with Zod; invalid output leaves the saved report intact. Summaries are labelled derived information and original advisory severity, area, validity, and provenance remain visible independently.

The live integration has a configurable timeout capped at 180 seconds and handles rate limits, invalid responses, and outages. Unit tests stub the model transport. Ollama is configured locally; the Gemma weights must finish downloading before live inference can run. Real Assamese quality and translation accuracy require evaluation with local reviewers.

Official Gemma guidance: https://ai.google.dev/gemma/docs/get_started

## Architecture

```text
app/                 App Router pages and Route Handler APIs
components/          Shared layout, forms, dashboards, workflow screens
components/maps/     Browser-only Leaflet / OpenStreetMap integration
lib/domain.ts        Shared types, input/model validation, state transitions
lib/repository.ts    Atomic SQLite persistence, idempotency, durable AI jobs
lib/ai.ts            Server-side Gemma adapter and grounded guidance selection
lib/auth.ts          Signed responder cookie, authorisation, request limits
lib/offline.ts       IndexedDB draft/queue persistence
lib/guidance.ts      Curated, source-attributed preparedness collection
lib/sources.ts       Explicit demo source adapter and future source contract
tests/               Validation, transitions, persistence, AI failure tests
docs/                Deployment and source integration notes
```

Verification (`unverified / under_review / verified / rejected`) is separate from response (`new / assigned / in_progress / resolved / closed`). Urgent unverified reports can be assigned for investigation. Verification, rejection, closure, and resolution require recorded evidence or an outcome. Several reports can be represented on one incident in the model, but report merge/corroboration tools are deferred.

## APIs

| Endpoint                              | Purpose                                                     |
| ------------------------------------- | ----------------------------------------------------------- |
| `GET /api/snapshot`                   | Shared data snapshot; resumes queued AI jobs                |
| `GET /api/intake`                     | Anonymous device cookie and signed submission token         |
| `POST /api/reports`                   | Validated, idempotent community submission                  |
| `PATCH /api/incidents/:id`            | Authenticated, revision-checked responder action            |
| `GET/POST/DELETE /api/auth`           | Session state, sign-in, sign-out                            |
| `GET/POST/DELETE /api/authority-auth` | Prototype authority session                                 |
| `POST /api/authority-advisories`      | Authority-only audited advisory publication                 |
| `POST /api/relief`                    | Authorized, revision-checked relief updates                 |
| `POST /api/ai`                        | Interpretation, advisory explanation, preparedness guidance |
| `GET /api/media/:file`                | Responder-only evidence photo                               |

## Build and verification

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

For a production-mode local run, configure a cryptographically random `SESSION_SECRET` (at least 32 characters). The requested `AUTHORITY_PASSWORD=1234` is for the prototype; replace shared-password access with individual authority accounts before public deployment. Local SQLite responder sessions also use `RESPONDER_PASSWORD`. Demo login is disabled in production. Cookie security expects HTTPS when deployed.

Tests cover rejected/invalid reports, evidence requirements, urgent unverified assignments, stale edits, response transitions, idempotency, atomic persistence, attachment checks, durable jobs, failure/retry behavior, curated language output, unsupported guidance questions, and validated live-model responses using stubs. The SQLite experimental warning on Node 22 is expected.

Intake tests also cover token expiry/tampering, duplicate and spam signals, and private snapshot projection. With the development server running in demo mode, `npm run test:smoke` exercises pages, consent/honeypot enforcement, private duplicate holds, and the complete authenticated response workflow. It retains clearly labelled TEST incidents for audit; never run it against a real emergency deployment.

The anonymous `bs-reporter` cookie gives a browser access to its held submissions; clearing it removes that access. This is not identity verification. Local `.data/intake.key` keeps tokens and development sessions stable across restarts. Preserve it with the database, keep `.data` private, and configure `SESSION_SECRET` in production.

## Data sources and honest limitations

All seeded incidents, warnings, shelters, response teams, and resource quantities are **simulated**. New community reports are real user submissions but remain unverified until reviewed in this prototype. Demo verification is never official verification. Alert links identify reference portals, not sources of fabricated live results.

Official integration references: [NDMA SACHET](https://sachet.ndma.gov.in/), [IMD](https://mausam.imd.gov.in/), [ASDMA](https://asdma.assam.gov.in/). Live Open-Meteo forecasts are connected. The generated thresholds are application rules, not official IMD/NDMA warnings. No official warning feed, SMS/WhatsApp delivery, rescue dispatch, or safe-route calculation is connected. See [live alerts and authority setup](docs/live-alerts.md).

Preparedness sources are stored with each approved excerpt in `lib/guidance.ts`: FEMA Ready.gov flood guidance, Government of India landslide precautions, and US National Weather Service lightning guidance. These are general educational materials; current local official instructions take precedence. Household kit items follow the [Ready.gov emergency-supply checklist](https://www.ready.gov/sites/default/files/2021-01/ready_emergency-supply-kit-checklist.pdf).

Core interface and guidance support English, Assamese and Hindi; some explanatory text falls back to English. Audio depends on installed browser voices. The safety page reports available observations without certifying unaffected areas. Official warning polygons, hospital records, hazard susceptibility zones, road closures, corroboration, and closed-browser push require further integrations.

## Deployment boundary

The default repository is designed for **one long-running Node app with a persistent disk**. It is not suitable for an ephemeral Vercel filesystem, multiple app replicas, or disaster-scale traffic. SQLite stores a prototype snapshot atomically; production requires normalized PostgreSQL/PostGIS tables, per-user identity/RBAC, robust distributed jobs, source authentication, backups, operational monitoring, and incident/privacy governance. See `docs/deployment.md` for the migration plan.

The prototype’s public views show report text and operational incident history. Do not enter private names, phone numbers, health details, or sensitive household locations. Real deployment needs redaction/moderation before public dissemination. In-memory request limits are suitable for local prototyping only; an external trusted rate limiter and bounded upload infrastructure are required for production.

During initial setup, `npm audit` reported five high-severity **development tooling** findings in the Next ESLint plugin's `fast-glob → micromatch → braces` chain. The registry's latest `braces` version was still 3.0.3, with no compatible patched version available. Avoid an automatic major downgrade of Next ESLint. Production-only dependencies are checked separately; recheck advisories before deployment.
