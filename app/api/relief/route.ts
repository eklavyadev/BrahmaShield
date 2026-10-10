import { reliefUpdateSchema } from "@/lib/domain";
import { saveReliefUpdate } from "@/lib/backend";
import { assertSameOrigin, failure, responderIdentity, readJson, rateLimit } from "@/lib/auth";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const identity = await responderIdentity();
    if (!identity)
      return Response.json({ error: "Authorized responder access is required." }, { status: 401 });
    rateLimit(`relief:${identity.id}`, 20);
    const input = reliefUpdateSchema.safeParse(await readJson(request));
    if (!input.success)
      return Response.json(
        { error: input.error.issues[0]?.message || "Invalid relief update." },
        { status: 400 },
      );
    const update = await saveReliefUpdate(input.data, identity.id);
    return Response.json(update);
  } catch (error) {
    return failure(error, error instanceof Error && error.message.includes("changed") ? 409 : 400);
  }
}
