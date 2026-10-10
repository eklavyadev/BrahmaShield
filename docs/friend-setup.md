# Run on the PC that already has Gemma

Clone the GitHub repository and use Node 22.20 or later. Run `npm ci`, then create `.env.local` from `.env.example`. The file is excluded from Git: copy the project URL, publishable key, secret key, and the same `SESSION_SECRET` from your trusted local configuration through a private channel.

On the friend's laptop, open PowerShell and run:

```powershell
git clone https://github.com/eklavyadev/BrahmaShield.git
cd BrahmaShield
npm ci
Copy-Item .env.example .env.local
ollama list
```

If the repository is already cloned, use `git pull` inside it and keep its existing `.env.local`. If `ollama list` cannot connect, open the Ollama desktop application or run `ollama serve` in a separate terminal. An already installed model does not need another download.

Set:

```dotenv
BACKEND=supabase
AI_MODE=live
GEMMA_BASE_URL=http://localhost:11434/v1
GEMMA_MODEL=gemma3:4b
GEMMA_TIMEOUT_MS=180000
GEMMA_API_KEY=
```

Also fill `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, and `SESSION_SECRET` using the existing private configuration. Do not commit or upload `.env.local` to GitHub. With both services on the same laptop, no public Ollama URL or firewall opening is needed. Local Ollama does not require an API key.

Use the exact installed model name from `ollama list`. If Ollama is already serving, no model download is necessary. The Supabase migration is already installed in this development project.

In separate terminals:

```sh
npm run dev
npm run worker
```

In a third terminal, from the same repository directory:

```powershell
npm run check:backend
npm run check:gemma
```

The first checks Supabase/private storage and model availability. The second calls the installed model with synthetic report text and validates a real generated interpretation. Open `http://localhost:3000/assistant` to try Gemma, or `http://localhost:3000/report` to submit an on-site report. Evaluate Assamese/mixed-language output with local speakers before claiming translation accuracy.

Report text flows from Next.js to local Ollama, while originals and validated analyses persist in Supabase. Gemma receives text/language, not photos or coordinates. It extracts stated facts and uncertainties, explains supplied advisories, and rewrites curated preparedness guidance. It never verifies reports, moves pins, assigns severity, or dispatches teams. The worker claims durable jobs, validates generated JSON, saves results, and preserves reports if inference fails. Triage-held reports wait for authorized review.

Phone geolocation requires a secure context. `localhost` works on the PC; a plain `http://192.168...` address opened on a phone generally does not. Use HTTPS for phone testing. When Next.js is deployed remotely, its localhost no longer reaches the friend's PC: use a protected reachable inference endpoint or host the app/worker alongside Ollama.

Live weather uses Open-Meteo by default, with no additional API key. Open `/authority` and use password `1234` for prototype overrides, advisories and relief publication. These changes use the existing snapshot storage, so this update needs no additional Supabase migration. See [live alert details](live-alerts.md).
