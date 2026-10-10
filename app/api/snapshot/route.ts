import { after } from "next/server";
import { cookies } from "next/headers";
import { isResponder } from "@/lib/auth";
import { hashDevice } from "@/lib/intake";
import { projectSnapshot } from "@/lib/projection";
import { snapshot } from "@/lib/repository";
import { processJobs } from "@/lib/ai";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  after(processJobs);
  const state = snapshot();
  const responder = await isResponder();
  const reporter = (await cookies()).get("bs-reporter")?.value;
  const ownerHash = reporter ? hashDevice(reporter) : null;
  return Response.json(projectSnapshot(state, responder, ownerHash), {
    headers: { "Cache-Control": "no-store" },
  });
}
