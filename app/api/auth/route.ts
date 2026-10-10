import { cookies } from "next/headers";
import {
  assertSameOrigin,
  createSession,
  demoLoginAllowed,
  failure,
  isResponder,
  rateLimit,
  readJson,
  validPassword,
} from "@/lib/auth";
export const runtime = "nodejs";
export async function GET() {
  return Response.json(
    { responder: await isResponder(), demoLogin: demoLoginAllowed() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    rateLimit(`login:${request.headers.get("x-forwarded-for") || "local"}`, 6);
    const body = (await readJson(request)) as { password?: unknown };
    if (typeof body.password !== "string" || !validPassword(body.password))
      return Response.json(
        { error: "Incorrect password or responder access is not configured." },
        { status: 401 },
      );
    (await cookies()).set("bs-session", createSession(), {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 8 * 3600,
    });
    return Response.json({ responder: true });
  } catch (error) {
    return failure(error);
  }
}
export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    (await cookies()).delete("bs-session");
    return Response.json({ responder: false });
  } catch (error) {
    return failure(error);
  }
}
