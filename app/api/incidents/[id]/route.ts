import { after } from "next/server";
import { actionSchema } from "@/lib/domain";
import { updateIncident } from "@/lib/backend";
import { assertSameOrigin, failure, responderIdentity, readJson, isAuthority } from "@/lib/auth";
import { projectSnapshot } from "@/lib/projection";
import { snapshot } from "@/lib/backend";
import { processJobs } from "@/lib/ai";
export const runtime = "nodejs";
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const identity = await responderIdentity();
    if (!identity)
      return Response.json({ error: "Responder sign-in is required." }, { status: 401 });
    const input = actionSchema.safeParse(await readJson(request));
    if (!input.success)
      return Response.json({ error: "Invalid incident action." }, { status: 400 });
    if (input.data.action === "override" && !(await isAuthority()))
      return Response.json(
        { error: "Authority access is required for an override." },
        { status: 403 },
      );
    const { id } = await context.params;
    const incident = await updateIncident(id, input.data, identity.id);
    if (
      ["retry_ai", "review", "verify"].includes(input.data.action) ||
      (input.data.action === "override" && input.data.verification === "verified")
    )
      after(processJobs);
    // Use the same private-field projection as snapshot responses.
    const state = await snapshot();
    return Response.json(
      projectSnapshot({ ...state, incidents: [incident] }, true, null).incidents[0],
    );
  } catch (error) {
    return failure(error, error instanceof Error && error.message.includes("changed") ? 409 : 400);
  }
}
