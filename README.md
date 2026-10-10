# BrahmaShield

A working Next.js disaster-resilience prototype for Assam and Northeast India. It connects community observations, Gemma interpretation, human evidence review, and tracked responder actions. It is not an official warning system or rescue service.

## Run locally

Requires Node.js **22.20+** (the local repository uses the built-in `node:sqlite` module) and npm.

```sh
npm ci
npm run dev
```

Open http://localhost:3000/dashboard. No credentials are needed for the local prototype. Data is seeded on first use and persists in `.data/brahmashield.sqlite`; uploads live in `.data/uploads`. Those files are ignored by Git.

Use **Observer → Enter local demo workspace** to try the server-protected responder workflow in development. This is explicit local demonstration access, not production identity management. Public reports start unverified and medium priority. An operator can change priority, verify evidence, assign a team, start a response, and record resolution. Assignments never contact an external team.

## What works

- Landing page, situation room, OSM map, alert center, community reporting, incident register/detail, response console, Gemma workspace, and preparedness center.
- Consistent persisted records across every screen, with 15-second polling and immediate refetch after actions.
- OpenStreetMap raster tiles through Leaflet, OSM attribution, independent hazard/shelter layers, clickable incident popups, zoom, fit-to-records, and accessible list fallback.
- Validated English/Assamese report form, device geolocation with manual map/coordinate fallback, optional JPEG/PNG evidence, and a trackable incident ID.
- Images are re-encoded on the client to reduce size and remove metadata; upload magic bytes and size are checked on the server. Photos require responder access.
- Original reports retained separately from AI output. One tested curated Assamese demonstration example; arbitrary reports are explicitly not translated in demo mode.
- Server-enforced verification and response lifecycles, evidence notes, an audit history, and optimistic revision checks that reject stale edits.
- Durable SQLite job records, report-first storage, explicit processing/failure states, and operator retry. Jobs run after requests and resume on snapshot requests; a continuous production worker is not implemented.
- Search, district/hazard/status/priority filters, CSV export, advisory explanations, source links, and derived dashboard charts.
- IndexedDB report drafts and queued submissions. A validated offline report retries when the open reporting page reconnects or is reopened. The interface only shows delivery after the server acknowledges it. Idempotency keys prevent duplicate retry submissions.
- Production-only service worker with cached previously visited report/preparedness pages, local static assets, and an offline fallback. APIs and external OSM tiles are never cached by the service worker.
- Source-grounded preparedness selection, device-persistent emergency-kit checklist, and optional browser speech synthesis in English.
- Responsive layouts, accessible labels, keyboard focus states, reduced-motion support, and a keyboard-trapped responder sign-in dialog.

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

The live integration has a 30-second timeout and handles rate limits, invalid responses, and outages. Unit tests stub the model transport. **No live Gemma endpoint was available during initial implementation, so real Assamese model quality, provider compatibility, latency, and translation accuracy still require evaluation.** Start with representative Assamese, transliterated, mixed-language, ambiguous-place, and adversarial examples before operational use.

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

| Endpoint | Purpose |
| --- | --- |
| `GET /api/snapshot` | Shared data snapshot; resumes queued AI jobs |
| `POST /api/reports` | Validated, idempotent community submission |
| `PATCH /api/incidents/:id` | Authenticated, revision-checked responder action |
| `GET/POST/DELETE /api/auth` | Session state, sign-in, sign-out |
| `POST /api/ai` | Interpretation, advisory explanation, preparedness guidance |
| `GET /api/media/:file` | Responder-only evidence photo |

## Build and verification

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

For a production-mode local run, configure `RESPONDER_PASSWORD` and a cryptographically random `SESSION_SECRET` (at least 32 characters). Demo login is disabled in production. Cookie security expects HTTPS when deployed.

Tests cover rejected/invalid reports, evidence requirements, urgent unverified assignments, stale edits, response transitions, idempotency, atomic persistence, attachment checks, durable jobs, failure/retry behavior, curated language output, unsupported guidance questions, and validated live-model responses using stubs. The SQLite experimental warning on Node 22 is expected.

## Data sources and honest limitations

All seeded incidents, warnings, shelters, response teams, and resource quantities are **simulated**. New community reports are real user submissions but remain unverified until reviewed in this prototype. Demo verification is never official verification. Alert links identify reference portals, not sources of fabricated live results.

Official integration references: [NDMA SACHET](https://sachet.ndma.gov.in/), [IMD](https://mausam.imd.gov.in/), [ASDMA](https://asdma.assam.gov.in/). No live official feed, forecast model, SMS/WhatsApp notifications, rescue dispatch, or safe-route calculation is connected.

Preparedness sources are stored with each approved excerpt in `lib/guidance.ts`: FEMA Ready.gov flood guidance, Government of India landslide precautions, and US National Weather Service lightning guidance. These are general educational materials; current local official instructions take precedence. Household kit items follow the [Ready.gov emergency-supply checklist](https://www.ready.gov/sites/default/files/2021-01/ready_emergency-supply-kit-checklist.pdf).

Interface Assamese is limited to the reporting flow. Device audio uses available English voices; Assamese audio is not claimed. Official warning polygons, hospital records, hazard susceptibility zones, road closures, multiple-report corroboration, and push notifications require sourced integrations.

## Deployment boundary

The default repository is designed for **one long-running Node app with a persistent disk**. It is not suitable for an ephemeral Vercel filesystem, multiple app replicas, or disaster-scale traffic. SQLite stores a prototype snapshot atomically; production requires normalized PostgreSQL/PostGIS tables, per-user identity/RBAC, robust distributed jobs, source authentication, backups, operational monitoring, and incident/privacy governance. See `docs/deployment.md` for the migration plan.

The prototype’s public views show report text and operational incident history. Do not enter private names, phone numbers, health details, or sensitive household locations. Real deployment needs redaction/moderation before public dissemination. In-memory request limits are suitable for local prototyping only; an external trusted rate limiter and bounded upload infrastructure are required for production.

During initial setup, `npm audit` reported five high-severity **development tooling** findings in the Next ESLint plugin's `fast-glob → micromatch → braces` chain. The registry's latest `braces` version was still 3.0.3, with no compatible patched version available. Avoid an automatic major downgrade of Next ESLint. Production-only dependencies are checked separately; recheck advisories before deployment.
