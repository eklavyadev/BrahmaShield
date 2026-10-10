import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { issueIntakeToken } from "@/lib/intake";
import { failure, rateLimit } from "@/lib/auth";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    rateLimit(`intake:${request.headers.get("x-forwarded-for") || "local"}`, 120);
    const jar = await cookies();
    let device = jar.get("bs-reporter")?.value;
    if (!device || !/^[a-f0-9]{64}$/.test(device)) {
      device = randomBytes(32).toString("hex");
      jar.set("bs-reporter", device, {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production" || new URL(request.url).protocol === "https:",
        maxAge: 30 * 86400,
        path: "/",
      });
    }
    return Response.json(
      { token: issueIntakeToken(device) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error, 429);
  }
}
