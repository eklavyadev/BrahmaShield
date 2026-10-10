"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ExternalLink, Volume2, Square, Backpack, Sparkles } from "lucide-react";
import { guidance, kitItems } from "@/lib/guidance";
import { HazardIcon, PageTitle } from "./ui";
export function PreparednessPage() {
  const [checked, setChecked] = useState<string[]>([]);
  const [speaking, setSpeaking] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    Promise.resolve().then(() => {
      try {
        const stored = JSON.parse(localStorage.getItem("bs-emergency-kit") || "[]");
        if (Array.isArray(stored))
          setChecked(stored.filter((item) => typeof item === "string" && kitItems.includes(item)));
      } catch {
        /* Optional device preferences. */
      }
    });
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);
  function toggle(item: string) {
    const next = checked.includes(item)
      ? checked.filter((value) => value !== item)
      : [...checked, item];
    setChecked(next);
    try {
      localStorage.setItem("bs-emergency-kit", JSON.stringify(next));
    } catch {
      setNotice("Checklist preferences could not be saved on this device.");
    }
  }
  function speak(id: string, text: string) {
    if (!("speechSynthesis" in window)) {
      setNotice("Audio playback is unavailable in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    if (speaking === id) {
      setSpeaking("");
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-IN";
    utterance.rate = 0.92;
    utterance.onend = () => setSpeaking("");
    utterance.onerror = () => {
      setSpeaking("");
      setNotice("Audio voice unavailable. The guidance remains readable below.");
    };
    setSpeaking(id);
    window.speechSynthesis.speak(utterance);
  }
  return (
    <>
      <PageTitle
        eyebrow="PREPARE BEFORE CONDITIONS CHANGE"
        title="Community preparedness center"
        description="Simple guidance, source links, and a household checklist. Follow current local authority instructions."
      >
        <Link href="/assistant" className="button">
          <Sparkles size={15} />
          Ask about preparedness
        </Link>
      </PageTitle>
      <div className="notice">
        Curated general guidance, not a local evacuation plan. English audio depends on your
        device’s available voices. For Assamese explanations, use the assistant with a live Gemma
        endpoint.
      </div>
      {notice && (
        <p role="status" className="notice warning">
          {notice}
        </p>
      )}
      <div className="three-columns guidance-grid">
        {guidance.map((source) => (
          <article className="panel guidance-card" key={source.id}>
            <div className="guidance-icon">
              <HazardIcon hazard={source.hazard} size={26} />
            </div>
            <h2>{source.title}</h2>
            <ul>
              {source.items.map((item) => (
                <li key={item}>
                  <CheckCircle2 size={15} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="advisory-footer">
              <a className="text-link" target="_blank" rel="noreferrer" href={source.url}>
                Read source <ExternalLink size={13} />
              </a>
              <button
                className="icon-button"
                aria-label={speaking === source.id ? "Stop audio" : `Listen to ${source.title}`}
                onClick={() => speak(source.id, `${source.title}. ${source.items.join(" ")}`)}
              >
                {speaking === source.id ? <Square size={15} /> : <Volume2 size={18} />}
              </button>
            </div>
            <p className="small muted">{source.source}</p>
          </article>
        ))}
      </div>
      <div className="two-columns preparedness-bottom">
        <section className="panel">
          <div className="panel-heading">
            <h2>
              <Backpack size={17} className="teal" />
              Household emergency kit
            </h2>
            <span className="small muted">
              {checked.length} / {kitItems.length} prepared
            </span>
          </div>
          <div className="kit-progress">
            <progress value={checked.length} max={kitItems.length} />
            <p className="small muted">Saved on this device · adapt to your household’s needs</p>
          </div>
          <div className="kit-list">
            {kitItems.map((item) => (
              <label key={item} className={checked.includes(item) ? "checked" : ""}>
                <input
                  type="checkbox"
                  checked={checked.includes(item)}
                  onChange={() => toggle(item)}
                />
                {item}
              </label>
            ))}
          </div>
        </section>
        <section className="panel padded">
          <div className="eyebrow">INCLUSIVE PREPAREDNESS</div>
          <h2>
            Plan around the people
            <br />
            who need support.
          </h2>
          <p>
            Discuss communication, mobility, medicines, and assistance needs with your household
            before disruption occurs.
          </p>
          <p>
            Include children, older adults, people with disabilities, and neighbours who may need
            help. Keep sensitive health and contact information in your private household plan.
          </p>
          <div className="action-divider" />
          <h3>Know where updates come from</h3>
          <a
            href="https://sachet.ndma.gov.in/"
            className="source-link"
            target="_blank"
            rel="noreferrer"
          >
            NDMA SACHET <ExternalLink size={14} />
          </a>
          <a
            href="https://mausam.imd.gov.in/"
            className="source-link"
            target="_blank"
            rel="noreferrer"
          >
            India Meteorological Department <ExternalLink size={14} />
          </a>
          <a
            href="https://asdma.assam.gov.in/"
            className="source-link"
            target="_blank"
            rel="noreferrer"
          >
            Assam State Disaster Management Authority <ExternalLink size={14} />
          </a>
        </section>
      </div>
    </>
  );
}
