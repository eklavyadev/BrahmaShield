import { cookies } from "next/headers";
import { attachment, storedSnapshot } from "@/lib/backend";
import { failure, isResponder } from "@/lib/auth";
import { hashDevice } from "@/lib/intake";
import { canViewReportPhoto } from "@/lib/photo-access";
export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ file: string }> }) {
  try {
    const { file } = await context.params;
    if (!/^[a-f0-9-]{36}\.(png|jpg)$/.test(file)) return new Response("Not found", { status: 404 });
    const state = await storedSnapshot();
    const incident = state.incidents.find((item) =>
      item.reports.some((report) => report.imagePath === file),
    );
    const report = incident?.reports.find((item) => item.imagePath === file);
    if (!incident || !report) return new Response("Not found", { status: 404 });
    const device = (await cookies()).get("bs-reporter")?.value;
    if (
      !canViewReportPhoto(incident, report, await isResponder(), device ? hashDevice(device) : null)
    )
      return new Response(
        "This photo is private. Use the submitting browser or authority dashboard.",
        { status: 401, headers: { "Cache-Control": "private, no-store" } },
      );
    const buffer = await attachment(file);
    if (!buffer) return new Response("Not found", { status: 404 });
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": file.endsWith("png") ? "image/png" : "image/jpeg",
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return failure(error, 503);
  }
}
