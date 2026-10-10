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
  signInSupabase,
} from "@/lib/auth";
import { cloudEnabled } from "@/lib/supabase";
export const runtime = "nodejs";
export async function GET() {
  return Response.json(
    {
      responder: await isResponder(),
      demoLogin: demoLoginAllowed(),
      authMode: cloudEnabled() ? "supabase" : "local",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    rateLimit(`login:${request.headers.get("x-forwarded-for") || "local"}`, 6);
    const body = (await readJson(request)) as { password?: unknown; email?: unknown };
    if (cloudEnabled()) {
      if (
        typeof body.email !== "string" ||
        typeof body.password !== "string" ||
        body.email.length > 320 ||
        body.password.length > 256
      )
        return Response.json(
          { error: "Enter your responder email and password." },
          { status: 400 },
        );
      await signInSupabase(body.email.trim(), body.password);
      return Response.json({ responder: true });
    }
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
    const token = (await cookies()).get("bs-access")?.value;
    (await cookies()).delete("bs-access");
    if (token && cloudEnabled()) {
      const { supabaseRequest } = await import("@/lib/supabase");
      await supabaseRequest(
        "/auth/v1/logout?scope=local",
        { method: "POST", headers: { Authorization: `Bearer ${token}` } },
        false,
      ).catch(() => {});
    }
    return Response.json({ responder: false });
  } catch (error) {
    return failure(error);
  }
}
