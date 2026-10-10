import { z } from "zod";
import type { Alert } from "./domain";
import { snapshot } from "./backend";
export interface DataSource {
  id: string;
  name: string;
  mode: "demo" | "official";
  referenceUrl: string;
  lastCheckedAt: string | null;
}
export interface AlertSourceAdapter {
  source: DataSource;
  fetchAlerts(): Promise<Alert[]>;
}
export const incomingAlertSchema = z.object({
  sourceId: z.string().min(1),
  externalId: z.string().min(1),
  title: z.string().min(1),
  issuedAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable(),
  severity: z.string().min(1),
  original: z.string().min(1),
  sourceUrl: z.string().url(),
  affectedAreas: z.array(z.string()),
  messageType: z.enum(["alert", "update", "cancel"]),
  references: z.array(z.string()),
});
export const demoAlertAdapter: AlertSourceAdapter = {
  source: {
    id: "demo",
    name: "BrahmaShield simulated advisories",
    mode: "demo",
    referenceUrl: "https://sachet.ndma.gov.in/",
    lastCheckedAt: null,
  },
  async fetchAlerts() {
    return (await snapshot()).alerts.filter((alert) => alert.demo);
  },
};
