/**
 * Local clipboard history for the navigation page (Spotlight-style).
 * Metadata lives in localStorage; image/file blobs live in IndexedDB.
 * Entries expire after 24 hours.
 */

export type NavClipKind = "text" | "image" | "file" | "rich";

export interface NavClipItem {
  id: string;
  kind: NavClipKind;
  /** Text payload, plain-text preview for rich clips, or a label for binary items. */
  text: string;
  /** MIME type for binary items (e.g. image/png, application/pdf). */
  mime?: string;
  /** Original file name when the clip came from a file. */
  name?: string;
  /** Byte size for binary items. */
  size?: number;
  /**
   * For `rich` clips: the MIME types kept for this entry (text/plain, text/html, image/*…).
   * Blobs are stored in IndexedDB under `${id}::${mime}` so mixed layouts round-trip.
   */
  parts?: string[];
  createdAt: number;
}

export const NAV_CLIP_TTL_MS = 24 * 60 * 60 * 1000;
export const NAV_CLIP_MAX_ITEMS = 50;
/** Skip absurdly large pastes; they will not fit in browser storage comfortably. */
export const NAV_CLIP_MAX_BYTES = 8 * 1024 * 1024;
/** Rich HTML payloads above this size fall back to storing only plain text. */
export const NAV_CLIP_MAX_HTML_BYTES = 512 * 1024;
const STORAGE_KEY = "nav-clip-history";
const DB_NAME = "nav-clip-blobs";
const DB_STORE = "blobs";

export const clipPartKey = (id: string, mime: string): string => `${id}::${mime}`;

const newId = (): string => `clip-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const pruneClips = (items: NavClipItem[], now = Date.now()): NavClipItem[] =>
  items.filter((item) => now - item.createdAt < NAV_CLIP_TTL_MS).slice(0, NAV_CLIP_MAX_ITEMS);

const parseItem = (entry: unknown): NavClipItem | null => {
  if (typeof entry !== "object" || entry === null) return null;
  const record = entry as Record<string, unknown>;
  const createdAt = typeof record.createdAt === "number" && Number.isFinite(record.createdAt) ? record.createdAt : 0;
  if (!createdAt) return null;
  const id = typeof record.id === "string" && record.id ? record.id : newId();
  const rawKind = typeof record.kind === "string" ? record.kind : "text";
  const kind: NavClipKind =
    rawKind === "image" || rawKind === "file" || rawKind === "rich" ? (rawKind as NavClipKind) : "text";
  if (kind === "text") {
    const text = typeof record.text === "string" ? record.text : "";
    if (!text.trim()) return null;
    return { id, kind: "text", text: text.slice(0, 2000), createdAt };
  }
  const parts = Array.isArray(record.parts)
    ? record.parts.filter((part): part is string => typeof part === "string" && part.length > 0)
    : undefined;
  return {
    id,
    kind,
    text: typeof record.text === "string" ? record.text.slice(0, 200) : "",
    mime: typeof record.mime === "string" ? record.mime : undefined,
    name: typeof record.name === "string" ? record.name.slice(0, 120) : undefined,
    size: typeof record.size === "number" && Number.isFinite(record.size) ? record.size : undefined,
    parts: kind === "rich" ? (parts ?? []) : parts,
    createdAt,
  };
};

export const readClips = (now = Date.now()): NavClipItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const items: NavClipItem[] = [];
    for (const entry of parsed) {
      const item = parseItem(entry);
      if (item) items.push(item);
    }
    return pruneClips(items, now);
  } catch {
    return [];
  }
};

export const writeClips = (items: NavClipItem[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pruneClips(items)));
  } catch {
    // Storage full or unavailable — history is best-effort.
  }
};

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("indexedDB unavailable"));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("indexedDB open failed"));
  });

export const putClipBlob = async (id: string, blob: Blob): Promise<void> => {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).put(blob, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("indexedDB put failed"));
    });
  } finally {
    db.close();
  }
};

export const getClipBlob = async (id: string): Promise<Blob | null> => {
  try {
    const db = await openDb();
    const blob = await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readonly");
      const request = tx.objectStore(DB_STORE).get(id);
      request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error("indexedDB get failed"));
    });
    db.close();
    return blob;
  } catch {
    return null;
  }
};

export const deleteClipBlob = async (key: string): Promise<void> => {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("indexedDB delete failed"));
    });
    db.close();
  } catch {
    // Best-effort cleanup.
  }
};

export const pruneClipBlobs = async (items: NavClipItem[]): Promise<void> => {
  try {
    const db = await openDb();
    // Keys are either a bare clip id (single-blob clips) or `${id}::${mime}` (rich parts).
    const keep = (key: string) => items.some((item) => key === item.id || key.startsWith(`${item.id}::`));
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      const store = tx.objectStore(DB_STORE);
      const cursorReq = store.openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) return;
        if (typeof cursor.key === "string" && !keep(cursor.key)) cursor.delete();
        cursor.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("indexedDB prune failed"));
    });
    db.close();
  } catch {
    // Best-effort cleanup.
  }
};

/** Dedupes text by value, binary by (kind, mime, name, size), rich by part signature. Newest first. */
export const addClipItem = (item: Omit<NavClipItem, "id" | "createdAt">, now = Date.now(), existing?: NavClipItem[]): NavClipItem[] => {
  const base = existing ?? readClips(now);
  const nextItem: NavClipItem = { ...item, id: newId(), createdAt: now };
  if (nextItem.kind === "text") {
    const trimmed = nextItem.text.trim();
    if (!trimmed) return pruneClips(base, now);
    nextItem.text = trimmed.slice(0, 2000);
    return pruneClips([nextItem, ...base.filter((entry) => entry.kind !== "text" || entry.text !== nextItem.text)], now);
  }
  if (nextItem.kind === "rich") {
    const parts = (nextItem.parts ?? []).slice().sort().join("|");
    return pruneClips(
      [nextItem, ...base.filter((entry) => !(entry.kind === "rich" && (entry.parts ?? []).slice().sort().join("|") === parts))],
      now,
    );
  }
  return pruneClips(
    [
      nextItem,
      ...base.filter(
        (entry) =>
          !(
            entry.kind === nextItem.kind &&
            entry.mime === nextItem.mime &&
            (entry.name ?? "") === (nextItem.name ?? "") &&
            (entry.size ?? 0) === (nextItem.size ?? 0)
          ),
      ),
    ],
    now,
  );
};

export const addClip = (text: string, now = Date.now(), existing?: NavClipItem[]): NavClipItem[] =>
  addClipItem({ kind: "text", text }, now, existing);

export const addImageClip = async (blob: Blob, now = Date.now(), existing?: NavClipItem[]): Promise<NavClipItem[]> => {
  if (!blob.type.startsWith("image/") || blob.size === 0 || blob.size > NAV_CLIP_MAX_BYTES) {
    return existing ?? readClips(now);
  }
  const item: Omit<NavClipItem, "id" | "createdAt"> = {
    kind: "image",
    text: blob.type,
    mime: blob.type,
    size: blob.size,
  };
  const next = addClipItem(item, now, existing);
  const created = next[0];
  try {
    await putClipBlob(created.id, blob);
  } catch {
    // Metadata still lists the clip; binary may be missing if storage is unavailable.
  }
  return next;
};

export const addFileClip = async (file: File, now = Date.now(), existing?: NavClipItem[]): Promise<NavClipItem[]> => {
  if (!file.size || file.size > NAV_CLIP_MAX_BYTES) return existing ?? readClips(now);
  const mime = file.type || "application/octet-stream";
  if (mime.startsWith("image/")) return addImageClip(file, now, existing);
  const item: Omit<NavClipItem, "id" | "createdAt"> = {
    kind: "file",
    text: file.name || mime,
    mime,
    name: file.name || "file",
    size: file.size,
  };
  const next = addClipItem(item, now, existing);
  try {
    await putClipBlob(next[0].id, file);
  } catch {
    // Best-effort blob storage.
  }
  return next;
};

/**
 * Stores mixed clipboard payloads (text/html + text/plain + image/*) as one entry so
 * copying it back writes every format and paste targets keep the original layout.
 */
export const addRichClip = async (
  payload: Record<string, string | Blob>,
  now = Date.now(),
  existing?: NavClipItem[],
): Promise<NavClipItem[]> => {
  const blobs: Array<{ mime: string; blob: Blob }> = [];
  let plain = "";
  let html = "";

  for (const [mime, value] of Object.entries(payload)) {
    if (typeof value === "string") {
      if (mime === "text/html") {
        if (value.length > NAV_CLIP_MAX_HTML_BYTES) continue;
        html = value;
      } else if (mime === "text/plain") {
        plain = value.slice(0, 2000);
      }
      continue;
    }
    if (!value.size || value.size > NAV_CLIP_MAX_BYTES) continue;
    if (mime.startsWith("image/") || mime.startsWith("text/") || mime.startsWith("application/")) {
      blobs.push({ mime, blob: value });
    }
  }

  // Need at least two representations to be meaningfully "rich" (html+text, html+image, text+image…).
  const representationCount = (html ? 1 : 0) + (plain.trim() ? 1 : 0) + blobs.length;
  if (representationCount < 2) {
    if (blobs.length === 1 && blobs[0].mime.startsWith("image/")) return addImageClip(blobs[0].blob, now, existing);
    if (plain.trim()) return addClip(plain, now, existing);
    return existing ?? readClips(now);
  }

  const parts: string[] = [];
  if (plain.trim()) parts.push("text/plain");
  if (html) parts.push("text/html");
  for (const part of blobs) parts.push(part.mime);

  const previewSource = plain.trim() || html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const item: Omit<NavClipItem, "id" | "createdAt"> = {
    kind: "rich",
    text: previewClip(previewSource || parts.join(" · "), 120),
    parts,
    size: [...(html ? [html.length] : []), ...blobs.map((part) => part.blob.size)].reduce((sum, n) => sum + n, 0),
  };
  const next = addClipItem(item, now, existing);
  const created = next[0];
  try {
    if (plain.trim()) await putClipBlob(clipPartKey(created.id, "text/plain"), new Blob([plain], { type: "text/plain" }));
    if (html) await putClipBlob(clipPartKey(created.id, "text/html"), new Blob([html], { type: "text/html" }));
    for (const part of blobs) await putClipBlob(clipPartKey(created.id, part.mime), part.blob);
  } catch {
    // Metadata still lists the clip; some parts may be missing if storage is unavailable.
  }
  return next;
};

/** Rebuilds a ClipboardItem-compatible record for a stored clip (for copy-back). */
export const buildClipWritePayload = async (item: NavClipItem): Promise<Record<string, Blob>> => {
  if (item.kind === "text") return { "text/plain": new Blob([item.text], { type: "text/plain" }) };
  if (item.kind === "rich") {
    const record: Record<string, Blob> = {};
    for (const mime of item.parts ?? []) {
      const blob = await getClipBlob(clipPartKey(item.id, mime));
      if (blob) record[mime] = blob;
    }
    if (!record["text/plain"] && item.text) {
      record["text/plain"] = new Blob([item.text], { type: "text/plain" });
    }
    return record;
  }
  const blob = await getClipBlob(item.id);
  const mime = item.mime || "application/octet-stream";
  return blob ? { [mime]: blob } : {};
};

export const removeClip = (id: string, existing?: NavClipItem[], now = Date.now()): NavClipItem[] => {
  const list = existing ?? readClips(now);
  const target = list.find((item) => item.id === id);
  if (target?.kind === "rich") {
    for (const mime of target.parts ?? []) void deleteClipBlob(clipPartKey(id, mime));
  } else {
    void deleteClipBlob(id);
  }
  return pruneClips(list.filter((item) => item.id !== id), now);
};

export const previewClip = (text: string, max = 72): string => {
  const single = text.replace(/\s+/g, " ").trim();
  return single.length > max ? `${single.slice(0, max - 1)}…` : single;
};

export const formatClipSize = (bytes?: number): string => {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
