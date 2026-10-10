import type { Alert } from "./domain";
export const alertVersion = (alert: Alert) =>
  JSON.stringify([
    alert.id,
    alert.severity,
    alert.demo,
    alert.sourceType || "official",
    alert.sourceType === "forecast" ? null : alert.issuedAt,
  ]);
export function newAlertNotifications(
  alerts: Alert[],
  seen: string[],
  region: string,
  now: number,
) {
  const known = new Set(seen);
  return alerts.filter(
    (alert) =>
      !known.has(alertVersion(alert)) &&
      !alert.demo &&
      (region === "All districts" || alert.district === region) &&
      Date.parse(alert.issuedAt) <= now &&
      Date.parse(alert.expiresAt) > now,
  );
}
export function notificationContent(alerts: Alert[]) {
  const forecast = alerts.every((alert) => alert.sourceType === "forecast");
  return {
    title: `${forecast ? "Forecast advisory" : alerts.every((a) => a.sourceType === "authority") ? "Authority advisory" : "Weather alert"}${alerts.length > 1 ? ` · ${alerts.length} updates` : ""}`,
    body:
      alerts
        .slice(0, 3)
        .map((a) => `${a.district}: ${a.title}`)
        .join("\n") + (forecast ? "\nModel forecast · not an official warning" : ""),
  };
}
