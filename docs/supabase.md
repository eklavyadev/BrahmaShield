# Supabase and local Gemma

The app supports `BACKEND=sqlite` for local demonstrations and `BACKEND=supabase` for cloud persistence. Supabase mode never silently falls back to SQLite during an outage. Existing SQLite observations are not automatically uploaded or deleted.

1. Apply `supabase/migrations/202610100001_brahmashield.sql` in the Supabase SQL Editor.
2. Configure the server-only values from `.env.example` in `.env.local`. Keep the same strong `SESSION_SECRET` on every app/worker instance. Never expose the secret key through a `NEXT_PUBLIC_*` variable.
3. Start Ollama, run `ollama pull gemma3:4b`, and select `AI_MODE=live`, `GEMMA_BASE_URL=http://localhost:11434/v1`, and `GEMMA_MODEL=gemma3:4b`.
4. Run `npm run dev` and `npm run worker` in separate processes. Pending jobs wait while the model downloads or the serving endpoint is unavailable. Inference failures preserve the report and can be retried by an authorized operator.
5. Run `npm run check:backend`; inspect `/api/health` for database and model availability. Model availability does not constitute a quality or inference evaluation.

Cloud initialization starts empty. `SEED_DEMO_DATA=true` opts into simulated examples on the first initialization only; it never overwrites existing state. Alerts, teams, shelters, and resources require real sourced records before operational use.

Responder access uses existing Supabase email/password accounts and an active entry in `bs_responder_memberships`. Session tokens are stored in HttpOnly cookies and checked through Supabase Auth's `/user` endpoint rather than trusting decoded JWT fields. This handles the project's asymmetric signing keys without relying on a cached client claim. Supplied `SUPABASE_JWKS_URL` is retained for future local verification; the current authorization path uses Auth directly. Membership is checked on each protected request, and actions record the authenticated user ID. No public signup or automatic role grants exist.

An administrator can provision an existing responder account with:

```sql
insert into public.bs_responder_memberships (user_id, active)
select id, true from auth.users where email = 'actual-responder-email'
on conflict (user_id) do update set active = true;
```

The initial migration has been applied and cloud persistence/private storage checks passed in the development project. Test observations remain clearly marked TEST. `npm run test:cloud` writes additional TEST records; `npm run test:cloud-auth` creates a temporary test-only auth account, checks membership enforcement/revocation, and deletes that account afterward. Run these checks only in development.

The MVP uses a versioned JSON state document with atomic PostgreSQL compare-and-swap commits. Submission keys, AI jobs, and memberships are separate tables. This preserves the tested domain transitions and prevents concurrent saves from overwriting one another, but copying a whole snapshot is not a large-scale architecture. Normalize incidents/reports/events and add bounded pagination for large deployments.

The SQL grants and RLS deny publishable/authenticated clients direct access to state, jobs, and membership data. The server secret performs authorized operations. Evidence uses the private `bs-evidence` bucket and the app's responder-protected media route. Abandoned upload cleanup, image scanning, distributed request limits, reviewer roles by district, and production monitoring remain deployment work.

For a remote deployment, localhost refers to the deployed machine: host Ollama alongside the app/worker or configure a protected reachable model endpoint. A browser cannot connect to the developer's local Ollama on behalf of a hosted Next.js server.

References: [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys), [database functions](https://supabase.com/docs/guides/database/functions), [password authentication](https://supabase.com/docs/guides/auth/passwords), and [Ollama compatibility](https://docs.ollama.com/api/openai-compatibility).
