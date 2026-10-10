import type { Snapshot } from "./domain";
import { canViewReportPhoto } from "./photo-access";
export function projectSnapshot(
  state: Snapshot,
  responder: boolean,
  ownerHash: string | null,
): Snapshot {
  return {
    ...state,
    incidents: state.incidents
      .filter(
        (incident) =>
          responder ||
          incident.verification === "verified" ||
          !incident.reports.some((report) => report.quality?.disposition === "needs_triage") ||
          incident.reports.some((report) => report.reporterDeviceHash === ownerHash),
      )
      .map((incident) => ({
        ...incident,
        reports: incident.reports.map((report) => {
          const copy = { ...report };
          copy.canViewPhoto = canViewReportPhoto(incident, report, responder, ownerHash);
          delete copy.reporterDeviceHash;
          delete copy.evidenceDigest;
          return copy;
        }),
      })),
  };
}
