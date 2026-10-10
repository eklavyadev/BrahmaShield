"use client";
import { Translated as T } from "./language";

import { useState } from "react";
import {
  Sparkles,
  Send,
  Languages,
  BookOpen,
  MessageSquareText,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import { useApp } from "./provider";
import { PageTitle } from "./ui";
import type { AIAnalysis } from "@/lib/domain";
const sample = "নাওবৈচাৰ পথত পানী উঠিছে। কেইজনমান লোক পথৰ সিপাৰে আবদ্ধ হৈ আছে।";
export function AssistantPage() {
  const { data } = useApp();
  const [task, setTask] = useState("interpret");
  const [text, setText] = useState("");
  const [language, setLanguage] = useState("en");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    analysis?: AIAnalysis;
    answer?: string;
    mode: string;
    sources?: { title: string; url: string }[];
  } | null>(null);
  const [copied, setCopied] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, text, language }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setResult(body);
    } catch (error) {
      setError(error instanceof Error ? error.message : "AI is unavailable.");
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        result?.answer || JSON.stringify(result?.analysis, null, 2),
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Clipboard access is unavailable. Select the result text to copy it.");
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="LOCAL LANGUAGE → SHARED UNDERSTANDING"
        title="Gemma intelligence workspace"
        description="Interpret community observations and explain curated preparedness guidance."
      >
        <span className={`badge ${data?.aiMode === "live" ? "priority-low" : "priority-medium"}`}>
          <Sparkles size={13} />
          {data?.aiMode === "live" ? "Gemma inference configured" : "Explicit demo mode"}
        </span>
      </PageTitle>
      <div className="assistant-layout">
        <section className="panel assistant-input">
          <div className="assistant-tabs" role="tablist" aria-label="Assistant capabilities">
            <button
              role="tab"
              aria-selected={task === "interpret"}
              className={task === "interpret" ? "selected" : ""}
              onClick={() => {
                setTask("interpret");
                setText("");
                setResult(null);
              }}
            >
              <MessageSquareText size={16} />
              Interpret a report
            </button>
            <button
              role="tab"
              aria-selected={task === "preparedness"}
              className={task === "preparedness" ? "selected" : ""}
              onClick={() => {
                setTask("preparedness");
                setText("");
                setResult(null);
              }}
            >
              <BookOpen size={16} />
              Preparedness guidance
            </button>
          </div>
          <div className="form-body">
            <div className="assistant-intro">
              <div className="gemma-orb">
                <Sparkles size={27} />
              </div>
              <h2>
                {task === "interpret"
                  ? "Make local reports understandable"
                  : "Prepare with reliable information"}
              </h2>
              <p>
                {task === "interpret"
                  ? "Extract stated facts, preserve uncertainty, and keep the original words intact."
                  : "Ask about floods, landslides, or severe weather. Answers are grounded in a small curated guidance collection."}
              </p>
            </div>
            <form onSubmit={submit}>
              <label className="language-control">
                <Languages size={15} />
                <select
                  aria-label="Input or answer language"
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                >
                  <option value="en">English</option>
                  <option value="as">Assamese / অসমীয়া</option>
                  {task === "interpret" && <option value="mixed">Mixed / transliterated</option>}
                </select>
              </label>
              <label>
                <span className="sr-only">
                  {task === "interpret" ? "Community report text" : "Preparedness question"}
                </span>
                <textarea
                  rows={6}
                  minLength={task === "interpret" ? 15 : 3}
                  maxLength={task === "interpret" ? 4000 : 1000}
                  required
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder={
                    task === "interpret"
                      ? "Paste a community observation in its original language…"
                      : "How can my household prepare for flooding?"
                  }
                />
              </label>
              <div className="suggestion-list">
                {(task === "interpret"
                  ? ["Try Assamese report", "Try English report"]
                  : ["Prepare for flooding", "Landslide preparedness", "Emergency kit checklist"]
                ).map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => {
                      setText(
                        suggestion === "Try Assamese report"
                          ? sample
                          : suggestion === "Try English report"
                            ? "Water is rising on the road near Maijan. Some residents cannot cross. The extent is unknown."
                            : suggestion,
                      );
                      if (suggestion === "Try Assamese report") setLanguage("as");
                      else setLanguage("en");
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
              {error && (
                <p role="alert" className="form-error">
                  {error}
                </p>
              )}
              <button className="button primary full-width" disabled={busy}>
                <Send size={15} />
                {busy
                  ? "Processing…"
                  : task === "interpret"
                    ? "Interpret observation"
                    : "Explain preparedness guidance"}
              </button>
            </form>
            <p className="small muted">
              This sandbox does not create an incident. Use “Report a hazard” to submit information
              to the shared workspace.
            </p>
          </div>
        </section>
        <section className="panel assistant-output">
          <div className="panel-heading">
            <h2>Interpretation & evidence</h2>
            {result && (
              <button className="icon-button" aria-label="Copy result" onClick={() => void copy()}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            )}
          </div>
          {result ? (
            <div className="form-body">
              <span
                className={`badge ${result.mode === "demo" ? "priority-medium" : "priority-low"}`}
              >
                {result.mode === "demo"
                  ? "DEMO · not live AI"
                  : "Gemma generated · derived information"}
              </span>
              {result.analysis && (
                <>
                  <h3>Normalised summary</h3>
                  <p className="analysis-summary">{result.analysis.summary}</p>
                  <dl className="detail-facts">
                    <dt>Language</dt>
                    <dd>{result.analysis.language}</dd>
                    <dt>Hazard extracted</dt>
                    <dd>{result.analysis.hazard}</dd>
                    <dt>Location clues</dt>
                    <dd>{result.analysis.locationClues.join(", ") || "None extracted"}</dd>
                    <dt>Reported time</dt>
                    <dd>{result.analysis.reportedTime || "Not stated"}</dd>
                  </dl>
                  <h4>
                    {" "}
                    <T text={"Reported impact"} />{" "}
                  </h4>
                  <p>{result.analysis.impact.join("; ") || "Not established"}</p>
                  <h4>Unknown fields</h4>
                  <div className="tag-list">
                    {result.analysis.unknownFields.map((item) => (
                      <span key={item} className="badge neutral">
                        {item}
                      </span>
                    ))}
                  </div>
                  <div className="notice warning">{result.analysis.uncertainty.join(" ")}</div>
                </>
              )}
              {result.answer && <p className="preserve-lines">{result.answer}</p>}
              {result.sources?.map((source) => (
                <a
                  key={source.url}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="source-link"
                >
                  <ExternalLink size={14} />
                  {source.title}
                </a>
              ))}
            </div>
          ) : (
            <div className="assistant-empty">
              <Sparkles size={34} />
              <h3>A clearer picture starts here</h3>
              <p>
                Choose a task and supply a report or question. Extracted information and source
                links will appear here.
              </p>
              <div className="notice">
                Demo mode recognises one curated Assamese example. Other reports are preserved for
                review; arbitrary translations are not simulated.
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
