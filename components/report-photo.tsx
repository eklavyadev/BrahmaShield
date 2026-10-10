"use client";
import Image from "next/image";
import { useState } from "react";
import { Translated as T } from "./language";

export function ReportPhoto({
  file,
  alt,
  compact = false,
}: {
  file: string;
  alt: string;
  compact?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const url = `/api/media/${encodeURIComponent(file)}`;
  return (
    <figure className={`report-photo ${compact ? "compact" : ""}`}>
      {failed ? (
        <div className="report-photo-error" role="status">
          <p>
            <T text="Photo unavailable. Check your connection and photo access." />
          </p>
          <button
            className="button small-button"
            onClick={() => {
              setFailed(false);
              setAttempt((value) => value + 1);
            }}
          >
            <T text="Retry" />
          </button>
        </div>
      ) : (
        <a href={url} target="_blank" rel="noreferrer" aria-label={`Open photo: ${alt}`}>
          <Image
            src={`${url}?attempt=${attempt}`}
            alt={alt}
            width={1280}
            height={960}
            unoptimized
            onError={() => setFailed(true)}
          />
        </a>
      )}
      {!compact && (
        <figcaption>
          <T text="Uploaded report photo · select to view full size" />
        </figcaption>
      )}
    </figure>
  );
}
