import type { Incident, IncidentReport } from "./domain";

export function publicPhotoVisible(incident: Incident, report: IncidentReport) {
  return (
    report.publicPhotoConsent === true &&
    incident.verification !== "rejected" &&
    (incident.verification === "verified" ||
      !incident.reports.some((item) => item.quality?.disposition === "needs_triage"))
  );
}

export function canViewReportPhoto(
  incident: Incident,
  report: IncidentReport,
  responder: boolean,
  ownerHash: string | null,
) {
  return (
    !!report.imagePath &&
    (responder ||
      (!!ownerHash && report.reporterDeviceHash === ownerHash) ||
      publicPhotoVisible(incident, report))
  );
}
