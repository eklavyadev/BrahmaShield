import { after } from "next/server";
import { snapshot } from "@/lib/repository";
import { processJobs } from "@/lib/ai";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  after(processJobs);
  return Response.json(snapshot(), { headers: { "Cache-Control": "no-store" } });
}
