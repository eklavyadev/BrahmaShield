/** Server-only REST client. Never import this module from a client component. */
export function cloudEnabled() {
  return process.env.BACKEND === "supabase";
}
export class SupabaseError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(
      code === "PGRST202" || code === "PGRST205"
        ? "Supabase schema is not installed. Apply the BrahmaShield SQL migration."
        : "Supabase request failed. Please retry; your local draft remains saved.",
    );
  }
}
export async function supabaseRequest<T>(
  path: string,
  options: RequestInit = {},
  admin = true,
): Promise<T> {
  const base = process.env.SUPABASE_URL;
  const key = admin ? process.env.SUPABASE_SECRET_KEY : process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) throw new Error("Supabase server configuration is incomplete.");
  const response = await fetch(`${base.replace(/\/$/, "")}${path}`, {
    ...options,
    cache: "no-store",
    signal: options.signal ?? AbortSignal.timeout(20000),
    headers: { apikey: key, "Content-Type": "application/json", ...options.headers },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new SupabaseError(error.code || "SUPABASE_ERROR", response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
export const rpc = <T>(name: string, body: unknown) =>
  supabaseRequest<T>(`/rest/v1/rpc/${name}`, { method: "POST", body: JSON.stringify(body) });

export async function responderMembership(userId: string) {
  const rows = await supabaseRequest<{ user_id: string; active: boolean }[]>(
    `/rest/v1/bs_responder_memberships?user_id=eq.${encodeURIComponent(userId)}&active=eq.true&select=user_id,active`,
  );
  return rows.length === 1;
}
