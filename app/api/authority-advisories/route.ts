import { authorityAdvisorySchema } from "@/lib/domain";
import { saveAuthorityAdvisory } from "@/lib/backend";
import { assertSameOrigin, failure, isAuthority, readJson, rateLimit } from "@/lib/auth";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (!(await isAuthority()))
      return Response.json({ error: "Authority access is required." }, { status: 401 });
    rateLimit(`authority-advisory:${request.headers.get("x-forwarded-for") || "local"}`, 20);
    const input = authorityAdvisorySchema.safeParse(await readJson(request));
    if (!input.success)
      return Response.json(
        { error: input.error.issues[0]?.message || "Invalid advisory." },
        { status: 400 },
      );
    return Response.json(await saveAuthorityAdvisory(input.data, "prototype-authority"));
  } catch (error) {
    return failure(error, error instanceof Error && error.message.includes("changed") ? 409 : 400);
  }
}
