import { cookies } from "next/headers";
import {
  assertSameOrigin,
  createAuthoritySession,
  validAuthorityPassword,
  isAuthority,
  failure,
  rateLimit,
  readJson,
} from "@/lib/auth";
export const runtime = "nodejs";
export async function GET() {
  return Response.json(
    { authority: await isAuthority() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    rateLimit(`authority-login:${request.headers.get("x-forwarded-for") || "local"}`, 6);
    const body = (await readJson(request, 1000)) as { password?: unknown };
    if (
      typeof body.password !== "string" ||
      body.password.length > 256 ||
      !validAuthorityPassword(body.password)
    )
      return Response.json({ error: "Incorrect authority password." }, { status: 401 });
    (await cookies()).set("bs-authority", createAuthoritySession(), {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 7200,
    });
    return Response.json({ authority: true });
  } catch (error) {
    return failure(error);
  }
}
export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    (await cookies()).delete("bs-authority");
    return Response.json({ authority: false });
  } catch (error) {
    return failure(error);
  }
}
