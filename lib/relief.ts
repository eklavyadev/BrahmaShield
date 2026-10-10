import type { Snapshot, ReliefUpdateInput, ReliefUpdate } from "./domain";
import type { AuthorityAdvisoryInput, AuthorityAdvisory } from "./domain";
export function applyAuthorityAdvisory(
  state: Snapshot,
  input: AuthorityAdvisoryInput,
  actor: string,
): AuthorityAdvisory {
  const rows = state.authorityAdvisories || [];
  const existing = rows.find((row) => row.id === input.id);
  if ((existing?.revision || 0) !== input.expectedRevision)
    throw new Error("This advisory changed. Refresh before editing.");
  if (rows.length >= 500 && !existing) throw new Error("Advisory capacity reached.");
  const { expectedRevision, reason, ...fields } = input;
  const next: AuthorityAdvisory = {
    ...fields,
    revision: expectedRevision + 1,
    issuedAt: new Date().toISOString(),
    authority: "BrahmaShield authority desk",
    demo: false,
    sourceType: "authority",
    history: [
      ...(existing?.history || []),
      {
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        actor,
        message: `${fields.status === "withdrawn" ? "Withdrew" : existing ? "Updated" : "Published"} authority advisory — ${reason}`,
      },
    ],
  };
  state.authorityAdvisories = [next, ...rows.filter((row) => row.id !== input.id)];
  return next;
}
export function applyReliefUpdate(
  state: Snapshot,
  input: ReliefUpdateInput,
  actor: string,
): ReliefUpdate {
  const updates = state.reliefUpdates || [];
  const existing = updates.find((item) => item.id === input.id);
  if ((existing?.revision || 0) !== input.expectedRevision)
    throw new Error("This relief update changed. Refresh before editing.");
  if (updates.length >= 500 && !existing)
    throw new Error("Relief update capacity reached. Contact the administrator.");
  const { expectedRevision, ...fields } = input;
  const next = {
    ...fields,
    revision: expectedRevision + 1,
    updatedAt: new Date().toISOString(),
    updatedBy: actor,
    history: [
      ...(existing?.history || []),
      {
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        actor,
        message: `${existing ? "Updated" : "Published"} relief listing: ${fields.title}; status ${fields.status}; quantity ${fields.quantity ?? "not specified"}; source ${fields.sourceUrl}`,
      },
    ],
  };
  state.reliefUpdates = [next, ...updates.filter((item) => item.id !== input.id)];
  return next;
}
