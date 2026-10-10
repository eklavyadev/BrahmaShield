import { after } from "next/server";
import { cookies } from "next/headers";
import { hashDevice, validIntakeToken } from "@/lib/intake";
import { reportSchema } from "@/lib/domain";
import { submitReport } from "@/lib/backend";
import { assertSameOrigin, failure, rateLimit, readJson } from "@/lib/auth";
import { processJobs } from "@/lib/ai";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const device = (await cookies()).get("bs-reporter")?.value;
    const token = request.headers.get("x-intake-token");
    if (!device || !token || !validIntakeToken(token, device))
      return Response.json(
        { error: "Refresh the reporting form and retry. Your draft remains on this device." },
        { status: 403 },
      );
    rateLimit(`report-device:${hashDevice(device)}`, 10);
    rateLimit(`report-network:${request.headers.get("x-forwarded-for") || "local"}`, 120);
    const parsed = reportSchema.safeParse(await readJson(request, 1600000));
    if (!parsed.success)
      return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
    if (parsed.data.website)
      return Response.json(
        {
          error:
            "Submission failed an automated spam check. Please use the visible reporting fields.",
        },
        { status: 422 },
      );
    const result = await submitReport(parsed.data, hashDevice(device));
    after(processJobs);
    return Response.json(
      {
        id: result.incident.id,
        duplicate: result.duplicate,
        triage: result.incident.reports[0].quality?.disposition === "needs_triage",
      },
      { status: result.duplicate ? 200 : 201 },
    );
  } catch (error) {
    return failure(error);
  }
}
