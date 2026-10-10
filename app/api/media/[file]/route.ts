import { attachment } from "@/lib/backend";
import { isResponder } from "@/lib/auth";
export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ file: string }> }) {
  if (!(await isResponder())) return new Response("Responder access required", { status: 401 });
  const { file } = await context.params;
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
}
