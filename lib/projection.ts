import type { Snapshot } from "./domain";
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
          delete copy.reporterDeviceHash;
          delete copy.evidenceDigest;
          return copy;
        }),
      })),
  };
}
