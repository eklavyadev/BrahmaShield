import * as local from "./repository";
import * as cloud from "./cloud-repository";
import { cloudEnabled } from "./supabase";
import type {
  AIAnalysis,
  IncidentAction,
  ReportInput,
  ReliefUpdateInput,
  AuthorityAdvisoryInput,
} from "./domain";
import { weatherFeed } from "./weather-feed";
export const storedSnapshot = async () =>
  cloudEnabled() ? cloud.cloudSnapshot() : local.snapshot();
export const snapshot = async () => {
  const [state, feed] = await Promise.all([
    storedSnapshot(),
    process.env.ALERT_SOURCE === "demo" ? Promise.resolve(undefined) : weatherFeed(),
  ]);
  const authorityAlerts = (state.authorityAdvisories || []).filter(
    (row) => row.status === "active" && Date.parse(row.expiresAt) > Date.now(),
  );
  return feed
    ? { ...state, alerts: [...authorityAlerts, ...feed.alerts], weatherFeed: feed }
    : { ...state, alerts: [...authorityAlerts, ...state.alerts] };
};
export const submitReport = async (input: ReportInput, owner: string) =>
  cloudEnabled() ? cloud.cloudSubmit(input, owner) : local.submitReport(input, owner);
export const updateIncident = async (id: string, action: IncidentAction, actor = "Responder") =>
  cloudEnabled() ? cloud.cloudUpdate(id, action, actor) : local.updateIncident(id, action, actor);
export const attachment = async (file: string) =>
  cloudEnabled() ? cloud.cloudAttachment(file) : local.attachment(file);
export const saveReliefUpdate = async (input: ReliefUpdateInput, actor: string) =>
  cloudEnabled() ? cloud.cloudSaveReliefUpdate(input, actor) : local.saveReliefUpdate(input, actor);
export const saveAuthorityAdvisory = async (input: AuthorityAdvisoryInput, actor: string) =>
  cloudEnabled()
    ? cloud.cloudSaveAuthorityAdvisory(input, actor)
    : local.saveAuthorityAdvisory(input, actor);
export const claimJob = async () => (cloudEnabled() ? cloud.cloudClaim() : local.claimJob());
export async function finishJob(
  job: { id: string; incident_id: string; report_id: string; lease?: string },
  analysis?: AIAnalysis,
) {
  if (cloudEnabled()) {
    if (!job.lease) throw new Error("Missing job lease.");
    await cloud.cloudFinish({ ...job, lease: job.lease }, analysis);
  } else local.finishJob(job.id, job.incident_id, job.report_id, analysis);
}
