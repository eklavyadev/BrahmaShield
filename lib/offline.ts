import type { ReportInput } from "./domain";
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("brahmashield-drafts", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("drafts");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Your browser could not save the draft."));
  });
}
export async function readDraft(): Promise<ReportInput | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => { const transaction = db.transaction("drafts", "readonly"); const request = transaction.objectStore("drafts").get("report"); request.onsuccess = () => resolve(request.result || null); request.onerror = () => reject(request.error); transaction.oncomplete = () => db.close(); });
}
export async function saveDraft(report: ReportInput) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => { const transaction = db.transaction("drafts", "readwrite"); transaction.objectStore("drafts").put(report, "report"); transaction.oncomplete = () => { db.close(); resolve(); }; transaction.onerror = () => { db.close(); reject(new Error("Draft could not be saved.")); }; });
}
export async function clearDraft() {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => { const transaction = db.transaction("drafts", "readwrite"); transaction.objectStore("drafts").delete("report"); transaction.oncomplete = () => { db.close(); resolve(); }; transaction.onerror = () => { db.close(); reject(transaction.error); }; });
}
