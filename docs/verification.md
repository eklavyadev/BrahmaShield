# Prototype verification

Checked locally on 10 October 2026 using Node 22 and the development demo adapter.

- 26 unit/integration tests passed, covering submission validation, signed intake tokens, triage signals, private visibility, durable storage, idempotency, AI failure/retry, and responder transitions.
- HTTP smoke passed for all ten pages and the submit → review → verify → assign → start → resolve workflow. Consent and honeypot checks, duplicate holds, public snapshot filtering, authentication, and the curated Assamese example were exercised.
- ESLint passed. The optimized Next.js build completed successfully, including TypeScript validation.
- Browser checks exercised a report submission and responder actions. Desktop dashboard and 390 px mobile reporting were inspected; mobile reporting had no horizontal overflow and the closed navigation was hidden. No browser console errors were observed.

Screenshots are local artifacts under `.data/previews`, excluded from Git with other local data. Smoke checks retain TEST incidents with explanatory evidence/outcome notes.

Live Gemma inference, official feeds, external emergency dispatch, and production identity integrations were not configured or tested. Offline queue logic is implemented; an actual browser network-disconnection exercise was not performed. The service worker is enabled only in production and does not cache external OSM tiles. Distributed rate limiting, deployment security review, and load testing remain production work.

## Supabase and on-site reporting update

The Supabase migration was applied to the development project. Live cloud checks passed for persistent reports, device-bound idempotency, private evidence uploads/downloads, duplicate triage, optimistic revision conflicts, and simultaneous independent saves. The publishable key was denied direct access to state, memberships, and job functions. A temporary test account verified membership-required authentication, HttpOnly cookies, and immediate revocation; that account was removed.

On-site reporting HTTP checks rejected manual/map sources, old GPS fixes, accuracy beyond 200 metres, and missing photos. A fresh GPS/photo TEST submission was stored and retry returned the same incident. Browser testing confirmed a real gallery file could be selected, compressed, and rendered as a loaded photo preview. The interface had zero editable coordinate inputs and no sign-in dialog. The fixed map marker uses no picker callback or dragging handler.

The unit suite now contains 29 passing tests. GPS test coordinates are synthetic: this does not establish physical-presence guarantees or GPS spoof resistance. Live Gemma inference on the friend's PC is still to be checked; this machine no longer needs the model download. Follow `docs/friend-setup.md`.
