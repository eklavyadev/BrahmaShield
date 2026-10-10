import { aiMode, gemmaReady, interpret } from "../lib/ai";
async function main() {
  if (aiMode() !== "live") throw new Error("Set AI_MODE=live in .env.local.");
  if (!(await gemmaReady()))
    throw new Error(
      "The configured Gemma model is unavailable. Start Ollama and match GEMMA_MODEL to ollama list.",
    );
  const started = Date.now();
  const analysis = await interpret({
    description:
      "TEST observation: water is covering the approach road near a village bridge. The depth and number of affected people are unknown.",
    language: "en",
  });
  if (analysis.mode !== "live") throw new Error("Expected live Gemma inference.");
  console.log(
    `Live Gemma interpretation succeeded with ${analysis.model} in ${((Date.now() - started) / 1000).toFixed(1)} seconds.`,
  );
  console.log(`Summary: ${analysis.summary}`);
  console.log(
    "Output passed the application JSON schema. This smoke test does not evaluate local-language accuracy.",
  );
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Gemma check failed");
  process.exitCode = 1;
});
