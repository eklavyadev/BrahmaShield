import * as local from "./repository";
import * as cloud from "./cloud-repository";
import { cloudEnabled } from "./supabase";
import type { AIAnalysis, IncidentAction, ReportInput } from "./domain";
export const snapshot = async () => (cloudEnabled() ? cloud.cloudSnapshot() : local.snapshot());
export const submitReport = async (input: ReportInput, owner: string) =>
  cloudEnabled() ? cloud.cloudSubmit(input, owner) : local.submitReport(input, owner);
export const updateIncident = async (id: string, action: IncidentAction, actor = "Responder") =>
  cloudEnabled() ? cloud.cloudUpdate(id, action, actor) : local.updateIncident(id, action);
export const attachment = async (file: string) =>
  cloudEnabled() ? cloud.cloudAttachment(file) : local.attachment(file);
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
