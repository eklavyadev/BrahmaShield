# Run on the PC that already has Gemma

Clone the GitHub repository and use Node 22.20 or later. Run `npm ci`, then create `.env.local` from `.env.example`. The file is excluded from Git: copy the project URL, publishable key, secret key, and the same `SESSION_SECRET` from your trusted local configuration through a private channel.

Set:

```dotenv
BACKEND=supabase
AI_MODE=live
GEMMA_BASE_URL=http://localhost:11434/v1
GEMMA_MODEL=gemma3:4b
GEMMA_TIMEOUT_MS=180000
```

Use the exact installed model name from `ollama list`. If Ollama is already serving, no model download is necessary. The Supabase migration is already installed in this development project.

In separate terminals:

```sh
npm run dev
npm run worker
```

Check `npm run check:backend`, then open `/assistant` and interpret a sample report. A connected model means its weights are available; evaluate real Assamese output before claiming translation accuracy.

Report text flows from Next.js to local Ollama, while originals and validated analyses persist in Supabase. Gemma receives text/language, not photos or coordinates. It extracts stated facts and uncertainties, explains supplied advisories, and rewrites curated preparedness guidance. It never verifies reports, moves pins, assigns severity, or dispatches teams. The worker claims durable jobs, validates generated JSON, saves results, and preserves reports if inference fails. Triage-held reports wait for authorized review.

Phone geolocation requires a secure context. `localhost` works on the PC; a plain `http://192.168...` address opened on a phone generally does not. Use HTTPS for phone testing. When Next.js is deployed remotely, its localhost no longer reaches the friend's PC: use a protected reachable inference endpoint or host the app/worker alongside Ollama.
