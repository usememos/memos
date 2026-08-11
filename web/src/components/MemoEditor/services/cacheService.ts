import { fromJson, type JsonValue, toJson } from "@bufbuild/protobuf";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { AttachmentSchema } from "@/types/proto/api/v1/attachment_service_pb";

export const CACHE_DEBOUNCE_DELAY = 500;

const pendingSaves = new Map<string, number>();
const cursors = new Map<string, number>();
const STRUCTURED_CACHE_ENTRY_KIND = "memos.editor-cache";
const STRUCTURED_CACHE_ENTRY_VERSION = 2;

export interface EditorDraft {
  content: string;
  attachments: Attachment[];
}

function deserializeDraft(raw: string): EditorDraft {
  try {
    const parsed = JSON.parse(raw) as { kind?: unknown; version?: unknown; content?: unknown; attachments?: unknown };
    if (parsed.kind === STRUCTURED_CACHE_ENTRY_KIND && parsed.version === 1 && typeof parsed.content === "string") {
      return { content: parsed.content, attachments: [] };
    }
    if (
      parsed.kind === STRUCTURED_CACHE_ENTRY_KIND &&
      parsed.version === STRUCTURED_CACHE_ENTRY_VERSION &&
      typeof parsed.content === "string"
    ) {
      const attachments = Array.isArray(parsed.attachments)
        ? parsed.attachments.flatMap((value) => {
            try {
              return [fromJson(AttachmentSchema, value as JsonValue, { ignoreUnknownFields: true })];
            } catch {
              return [];
            }
          })
        : [];
      return { content: parsed.content, attachments };
    }
  } catch {
    // Drafts have historically been stored as raw markdown strings.
  }

  return { content: raw, attachments: [] };
}

function serializeDraft(content: string, attachments: Attachment[]): string {
  if (attachments.length === 0) {
    return content;
  }

  return JSON.stringify({
    kind: STRUCTURED_CACHE_ENTRY_KIND,
    version: STRUCTURED_CACHE_ENTRY_VERSION,
    content,
    attachments: attachments.map((attachment) => toJson(AttachmentSchema, attachment)),
  });
}

function writeEntry(key: string, content: string, attachments: Attachment[]): void {
  if (content.trim() || attachments.length > 0) {
    localStorage.setItem(key, serializeDraft(content, attachments));
  } else {
    localStorage.removeItem(key);
  }
}

export const cacheService = {
  key: (username: string, cacheKey?: string): string => {
    return `${username}-${cacheKey || ""}`;
  },

  save: (key: string, content: string, attachments: Attachment[] = []) => {
    const pendingSave = pendingSaves.get(key);
    if (pendingSave) {
      window.clearTimeout(pendingSave);
    }

    const timeoutId = window.setTimeout(() => {
      pendingSaves.delete(key);

      writeEntry(key, content, attachments);
    }, CACHE_DEBOUNCE_DELAY);

    pendingSaves.set(key, timeoutId);
  },

  saveNow: (key: string, content: string, attachments: Attachment[] = []) => {
    const pendingSave = pendingSaves.get(key);
    if (pendingSave) {
      window.clearTimeout(pendingSave);
      pendingSaves.delete(key);
    }

    writeEntry(key, content, attachments);
  },

  load(key: string): string {
    const raw = localStorage.getItem(key);
    return raw ? deserializeDraft(raw).content : "";
  },

  loadDraft(key: string): EditorDraft {
    const raw = localStorage.getItem(key);
    return raw ? deserializeDraft(raw) : { content: "", attachments: [] };
  },

  saveCursor(key: string, cursor: number): void {
    cursors.set(key, cursor);
  },

  loadCursor(key: string): number | undefined {
    return cursors.get(key);
  },

  clear(key: string): void {
    const pendingSave = pendingSaves.get(key);
    if (pendingSave) {
      window.clearTimeout(pendingSave);
      pendingSaves.delete(key);
    }

    localStorage.removeItem(key);
    cursors.delete(key);
  },

  clearAll(): void {
    for (const timeoutId of pendingSaves.values()) {
      window.clearTimeout(timeoutId);
    }
    pendingSaves.clear();
    cursors.clear();
  },
};
