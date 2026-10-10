# Production migration and source integration

## Current boundary

Run `npm run build` then `npm start` on a persistent Node 22.20+ host, behind HTTPS. Mount a persistent writable directory and set `DATA_DIRECTORY` to it. Configure strong `RESPONDER_PASSWORD` and `SESSION_SECRET` values. Do not put keys in `NEXT_PUBLIC_*` variables. Back up the SQLite database and uploads together. Only one app instance is supported.

The default local repository is a no-account, durable prototype. A Supabase adapter is now available: see [cloud setup](supabase.md). It uses individual Supabase accounts, responder memberships, private storage, leased jobs, and transactional version checks. No official emergency monitoring is performed.

## PostgreSQL / PostGIS migration

Replace the exported repository operations in `lib/repository.ts` with equivalent transactional database functions. Keep the API response/domain types so UI components do not need rewriting.

Recommended normalized tables:

- `incidents`: identifier, geography(Point,4326), district, verification, priority, response, assigned team, observation/receipt/review timestamps, revision.
- `reports`: immutable original text, language, observation timestamp, incident FK, private attachment reference, provenance.
- `ai_analyses`: report FK, model/version, validated JSON output, mode, processing timestamps.
- `incident_events`: append-only actor identity, action, time, evidence references, visibility.
- `source_alerts`: source and external identifiers, CAP message type/reference IDs, original text, official severity, area geography, issue/effective/expiry times, cancellation state.
- `teams`, `shelters`, `resources`: provenance, checked-at timestamps, district, quantities/capabilities. Source checks are separate from browser refresh.
- `submission_keys`: unique idempotency key and report result.
- `jobs`: report FK, state, attempts, next-attempt time, lease owner/expiry.
- `profiles`, `memberships`: authenticated identity, organisation and region roles.

Use PostGIS spatial indexes and `ST_Intersects`/`ST_DWithin` for affected-area queries. Adopt Supabase Auth with server-side role checks and row-level security. Keep private evidence and personal data outside the public incident view. Implement revision-based updates and append history in the same database transaction. Replace polling with carefully scoped realtime subscriptions and retain reconnection refetch.

The shipped Supabase migration implements the current MVP's versioned state document and separate submissions/jobs/membership tables. The normalized schema above is the next scale-up stage, not the current implementation.

## AI jobs

The prototype queue persists before inference starts. Request-driven `after()` processing handles up to two jobs, and snapshot requests recover abandoned leases after two minutes. Completed inference cannot mutate verification, coordinates, counts, or response priority. Failed jobs require an operator retry.

For production, run an independent job worker with bounded concurrency, exponential retry/backoff, per-provider rate limiting, dead-letter handling, metrics and model-version tracking. Keep response submission independent of model availability. Evaluate structured field accuracy and Assamese/mixed-language summaries with competent local reviewers. Add output review gates for safety-sensitive translations. Do not use model-provided confidence as a calibrated probability.

## Official alert adapters

`lib/sources.ts` defines a demo adapter and normalized incoming-alert schema. Before implementing NDMA SACHET, IMD or ASDMA integrations, establish supported access, authentication, usage conditions, polling limits and data formats with the source owner.

Retain original authority names and warning levels; do not map district advisories to precise local danger zones without sourced polygons. Preserve source IDs, CAP references, updates and cancellations. Separate observation time, source-check time, ingestion time, and expiry. Deduplicate by `(source_id, external_id)`. Store raw source documents for audit only with appropriate access/retention controls. If a source is unavailable, show the last checked time and stale/unavailable state rather than inventing new alerts.

Sources: https://sachet.ndma.gov.in/ and https://api.imd.gov.in/public/index.php

## OSM and offline behavior

Use Leaflet with standard OSM attribution. The prototype requests https://tile.openstreetmap.org/{z}/{x}/{y}.png directly and does not bulk-download, prefetch or cache OSM tiles in its service worker. For significant traffic, use a suitable tile provider or self-hosted tiles under its usage policy. Review https://operations.osmfoundation.org/policies/tiles/ before deployment.

Offline drafts/queued reports contain user-provided observations on the device. Clearing site data removes them. Automatic retry requires reopening or keeping the report screen open; background transmission while the application is closed is not claimed. Previsited preparedness/report pages are cached in production, and cached material must be labelled as educational or previously retrieved, never as live conditions.

## Operational gates

Before real use: source agreements, individual identity and regional RBAC, reviewer training, local-language evaluation, public-report moderation/redaction, privacy retention rules, independent safety content review, protected media storage, distributed rate limits, upload scanning, backups, failover, accessibility/mobile tests, and a notification delivery/acknowledgement design. This prototype remains a demonstration until those systems are established.
