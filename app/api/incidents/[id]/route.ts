import { after } from "next/server";
import { actionSchema } from "@/lib/domain";
import { updateIncident } from "@/lib/repository";
import { assertSameOrigin, failure, isResponder, readJson } from "@/lib/auth";
import { processJobs } from "@/lib/ai";
export const runtime = "nodejs";
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    if (!(await isResponder()))
      return Response.json({ error: "Responder sign-in is required." }, { status: 401 });
    const input = actionSchema.safeParse(await readJson(request));
    if (!input.success)
      return Response.json({ error: "Invalid incident action." }, { status: 400 });
    const { id } = await context.params;
    const incident = updateIncident(id, input.data);
    if (["retry_ai", "review", "verify"].includes(input.data.action)) after(processJobs);
    return Response.json(incident);
  } catch (error) {
    return failure(error, error instanceof Error && error.message.includes("changed") ? 409 : 400);
  }
}
