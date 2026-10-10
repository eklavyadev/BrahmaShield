import { snapshot } from "@/lib/backend";
import { cloudEnabled } from "@/lib/supabase";
import { aiMode } from "@/lib/ai";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  let database: { ready: boolean; message: string } = {
    ready: false,
    message: "Database unavailable",
  };
  let gemma: { ready: boolean; message: string } = {
    ready: false,
    message: "Gemma is not configured",
  };
  await Promise.all([
    snapshot()
      .then(() => {
        database = { ready: true, message: "Connected" };
      })
      .catch((error) => {
        database.message = error instanceof Error ? error.message : "Database unavailable";
      }),
    (async () => {
      if (aiMode() !== "live") {
        gemma = { ready: false, message: "Demo adapter selected" };
        return;
      }
      if (!process.env.GEMMA_BASE_URL || !process.env.GEMMA_MODEL) return;
      try {
        const response = await fetch(`${process.env.GEMMA_BASE_URL.replace(/\/$/, "")}/models`, {
          headers: process.env.GEMMA_API_KEY
            ? { Authorization: `Bearer ${process.env.GEMMA_API_KEY}` }
            : {},
          cache: "no-store",
          signal: AbortSignal.timeout(4000),
        });
        if (!response.ok) throw new Error();
        const result = await response.json();
        const installed = result.data?.some(
          (model: { id: string }) => model.id === process.env.GEMMA_MODEL,
        );
        gemma = {
          ready: installed === true,
          message: installed
            ? "Model available; inference not yet tested"
            : "Download the configured Gemma model in Ollama",
        };
      } catch {
        gemma.message = "Gemma serving endpoint is unavailable";
      }
    })(),
  ]);
  return Response.json(
    { backend: cloudEnabled() ? "supabase" : "sqlite", aiMode: aiMode(), database, gemma },
    { headers: { "Cache-Control": "no-store" } },
  );
}
