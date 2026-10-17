// Browser-only: sends voice notes, and keeps the ones that couldn't be sent
// (no signal, server busy) in IndexedDB so they upload later by themselves.

export type UploadResult =
  | { status: "ok"; draftId: string }
  /** Worth trying again later: offline, timeout, server busy or rate-limited. */
  | { status: "retry"; error?: string }
  /** Will never succeed as-is (too large, unsupported, generator gone, AI off). */
  | { status: "failed"; error: string };

export async function uploadRecording(generatorId: string, blob: Blob): Promise<UploadResult> {
  let response: Response;
  try {
    response = await fetch(`/api/generators/${generatorId}/voice-notes`, {
      method: "POST",
      headers: { "content-type": blob.type || "application/octet-stream" },
      body: blob,
    });
  } catch {
    return { status: "retry" };
  }
  const body = (await response.json().catch(() => ({}))) as { draftId?: string; error?: string };
  // Success or a recorded transcription failure: the review page explains which.
  if (response.ok && body.draftId) return { status: "ok", draftId: body.draftId };
  if (response.status === 401 || response.status === 408 || response.status === 429 || response.status >= 500) {
    if (body.error === "ai_disabled") return { status: "failed", error: "ai_disabled" };
    return { status: "retry", error: body.error };
  }
  return { status: "failed", error: body.error ?? "upload_failed" };
}

export type QueuedRecording = {
  id: string;
  generatorId: string;
  generatorLabel: string;
  blob: Blob;
  createdAt: number;
};

/** Fired on `window` whenever the queue changes. */
export const QUEUE_EVENT = "retrace:queue";

const DB_NAME = "retrace";
const STORE = "pendingRecordings";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = run(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function queueRecording(item: Omit<QueuedRecording, "id" | "createdAt">): Promise<void> {
  const record: QueuedRecording = { ...item, id: crypto.randomUUID(), createdAt: Date.now() };
  await withStore("readwrite", (store) => store.put(record));
  window.dispatchEvent(new Event(QUEUE_EVENT));
}

export async function listQueued(): Promise<QueuedRecording[]> {
  if (typeof indexedDB === "undefined") return [];
  const all = await withStore<QueuedRecording[]>("readonly", (store) => store.getAll());
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function removeQueued(id: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(id));
  window.dispatchEvent(new Event(QUEUE_EVENT));
}
