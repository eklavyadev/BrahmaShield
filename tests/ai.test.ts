import { test } from "node:test";
import assert from "node:assert/strict";
import { interpret } from "../lib/ai";
test("live Gemma output is validated and transport failures do not fall back silently", async () => {
  process.env.AI_MODE = "live";
  process.env.GEMMA_BASE_URL = "http://localhost:11434/v1";
  process.env.GEMMA_MODEL = "gemma3:4b";
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      Response.json({
        choices: [{ message: { content: '{"summary":"Invented incomplete response"}' } }],
      });
    await assert.rejects(interpret({ description: "Water rising on road", language: "en" }));
    globalThis.fetch = async () => new Response("busy", { status: 429 });
    await assert.rejects(
      interpret({ description: "Water rising on road", language: "en" }),
      /busy/,
    );
    globalThis.fetch = async () =>
      Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                language: "English",
                summary: "Water reported on road.",
                hazard: "flood",
                locationClues: [],
                reportedTime: null,
                impact: [],
                unknownFields: ["extent"],
                uncertainty: ["Not independently verified"],
              }),
            },
          },
        ],
      });
    const result = await interpret({ description: "Water rising on road", language: "en" });
    assert.equal(result.mode, "live");
    assert.equal(result.model, "gemma3:4b");
  } finally {
    globalThis.fetch = original;
    process.env.AI_MODE = "demo";
  }
});
