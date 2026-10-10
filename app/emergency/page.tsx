import { Phone, ExternalLink } from "lucide-react";
import { Translated as T } from "@/components/language";
export default function EmergencyPage() {
  return (
    <div className="emergency-page">
      <div className="page-title">
        <div>
          <h1>
            <T text="Emergency help" />
          </h1>
          <p>
            <T text="Call emergency services directly. This website cannot dispatch a rescue team." />
          </p>
        </div>
      </div>
      <div className="panel padded emergency-call-card">
        <a href="tel:112" className="button emergency-call">
          <Phone size={24} />
          <T text="Call 112" />
        </a>
        <p>
          <T text="If this laptop cannot make calls, use a mobile phone and dial the number shown." />
        </p>
        <a href="https://112.gov.in/" target="_blank" rel="noreferrer" className="text-link">
          <T text="Official emergency information" />
          <ExternalLink size={14} />
        </a>
      </div>
      <div className="two-columns emergency-options">
        <a href="tel:1070" className="panel padded">
          <Phone size={18} />
          <h2>
            <T text="Assam disaster helpline · 1070" />
          </h2>
        </a>
        <a href="tel:1077" className="panel padded">
          <Phone size={18} />
          <h2>
            <T text="District disaster control room · 1077" />
          </h2>
        </a>
      </div>
      <section className="panel padded">
        <h2>
          <T text="What to tell the operator" />
        </h2>
        <ol>
          <li>
            <T text="Give your district, village, nearest landmark and a callback number." />
          </li>
          <li>
            <T text="Describe the hazard, people needing help and any urgent medical or accessibility needs." />
          </li>
          <li>
            <T text="Follow the operator's instructions. Do not enter floodwater or unstable slopes to seek help." />
          </li>
        </ol>
        <a
          href="https://asdma.gov.in/project_helpline.html"
          target="_blank"
          rel="noreferrer"
          className="text-link"
        >
          ASDMA · 1070 <ExternalLink size={13} />
        </a>
        <a
          href="https://sribhumi.assam.gov.in/all-helplines-numbers"
          target="_blank"
          rel="noreferrer"
          className="text-link"
        >
          Assam district helplines · 1077 <ExternalLink size={13} />
        </a>
      </section>
    </div>
  );
}
