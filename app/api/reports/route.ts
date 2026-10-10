import { after } from "next/server";
import { reportSchema } from "@/lib/domain";
import { submitReport } from "@/lib/repository";
import { assertSameOrigin, failure, rateLimit, readJson } from "@/lib/auth";
import { processJobs } from "@/lib/ai";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    rateLimit(`report:${request.headers.get("x-forwarded-for") || "local"}`, 10);
    const parsed = reportSchema.safeParse(await readJson(request, 1600000));
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
    const result = submitReport(parsed.data);
    after(processJobs);
    return Response.json({ id: result.incident.id, duplicate: result.duplicate }, { status: result.duplicate ? 200 : 201 });
  } catch (error) { return failure(error); }
}
