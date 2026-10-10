import { Translated as T } from "@/components/language";
import Link from "next/link";
import { ArrowRight, Languages, ShieldCheck, Workflow, MapPinned } from "lucide-react";
import { PublicReports } from "@/components/public-reports";
export default function Home() {
  return (
    <div className="landing">
      <div className="eyebrow">
        <span className="status-dot" /> BUILT FOR NORTHEAST INDIA · PROTOTYPE
      </div>
      <h1>
        Local knowledge.
        <br />
        <span>Coordinated response.</span>
      </h1>
      <p className="landing-lead">
        When conditions change, every report matters. Bring community observations, verified
        information, and response teams into one shared picture.
      </p>
      <div className="button-row">
        <Link className="button primary" href="/dashboard">
          Open situation room <ArrowRight size={17} />
        </Link>
        <Link className="button" href="/report">
          {" "}
          <T text={"Report a hazard"} /> <MapPinned size={17} />
        </Link>
      </div>
      <div className="three-columns">
        <article className="panel padded">
          <Languages className="teal" />
          <h3>Understand every report</h3>
          <p>
            Keep the original words. Use Gemma to interpret local-language reports and surface what
            is known—and what needs checking.
          </p>
        </article>
        <article className="panel padded">
          <ShieldCheck className="teal" />
          <h3>Know what you can trust</h3>
          <p>
            See source, observation time, and review status. Community reports and official warnings
            carry distinct labels.
          </p>
        </article>
        <article className="panel padded">
          <Workflow className="teal" />
          <h3>Turn information into action</h3>
          <p>Review evidence, assign a team, and track progress in a shared incident history.</p>
        </article>
      </div>
      <p className="muted small">
        Weather advisories use model forecasts; demo resources are labelled. This app does not
        contact emergency services, issue official warnings, or certify travel routes.
      </p>
      <PublicReports />
    </div>
  );
}
