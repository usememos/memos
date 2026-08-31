import { create } from "@bufbuild/protobuf";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { memoServiceClient } from "@/connect";
import { attachmentKeys } from "@/hooks/useAttachmentQueries";
import { memoKeys } from "@/hooks/useMemoQueries";
import { userKeys } from "@/hooks/useUserQueries";
import { ListMemosRequestSchema, type Memo, MemoSchema } from "@/types/proto/api/v1/memo_service_pb";
import type { RaindropRow } from "./csv";
import { slugifyTag } from "./slugifyTag";

export interface ImportProgress {
  status: "idle" | "deduping" | "importing" | "done";
  total: number;
  created: number;
  skipped: number;
  failed: number;
}

const INITIAL_PROGRESS: ImportProgress = { status: "idle", total: 0, created: 0, skipped: 0, failed: 0 };
const CONCURRENCY = 3;

// Extracts link targets from previously imported memo content.
const LINK_TARGET_PATTERN = /\]\((https?:\/\/[^\s)]+)\)/g;

async function collectExistingUrls(): Promise<Set<string>> {
  const urls = new Set<string>();
  let pageToken = "";
  for (;;) {
    const response = await memoServiceClient.listMemos(
      create(ListMemosRequestSchema, {
        filter: "has_link",
        pageSize: 200,
        pageToken,
      }),
    );
    for (const memo of response.memos) {
      for (const match of memo.content.matchAll(LINK_TARGET_PATTERN)) {
        urls.add(match[1]);
      }
    }
    pageToken = response.nextPageToken;
    if (!pageToken) break;
  }
  return urls;
}

export function buildMemoContent(row: RaindropRow): string {
  const tags = [slugifyTag(row.folder), ...row.tags.map((tag) => tag.replace(/[^\p{L}\p{N}+-]/gu, ""))].filter(Boolean);
  const parts = [`[${row.title || row.url}](${row.url})`];
  if (tags.length > 0) {
    parts.push(tags.map((tag) => `#${tag}`).join(" "));
  }
  const note = [row.note, row.highlights].filter(Boolean).join("\n\n");
  if (note) {
    parts.push(note);
  }
  return parts.join("\n\n");
}

export function useBookmarkImport() {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<ImportProgress>(INITIAL_PROGRESS);
  const cancelled = useRef(false);

  const reset = useCallback(() => {
    cancelled.current = true;
    setProgress(INITIAL_PROGRESS);
  }, []);

  const cancel = useCallback(() => {
    cancelled.current = true;
  }, []);

  const start = useCallback(
    async (rows: RaindropRow[]) => {
      cancelled.current = false;
      setProgress({ ...INITIAL_PROGRESS, status: "deduping", total: rows.length });

      let existing: Set<string>;
      try {
        existing = await collectExistingUrls();
      } catch (error) {
        console.error("bookmark import dedupe fetch failed", error);
        existing = new Set();
      }

      const pending = rows.filter((row) => !existing.has(row.url));
      const skipped = rows.length - pending.length;
      setProgress({ ...INITIAL_PROGRESS, status: "importing", total: rows.length, skipped });

      let created = 0;
      let failed = 0;
      let next = 0;

      const worker = async () => {
        for (;;) {
          if (cancelled.current) return;
          const index = next++;
          if (index >= pending.length) return;
          const row = pending[index];
          try {
            const memo = create(MemoSchema, { content: buildMemoContent(row) }) as Memo;
            await memoServiceClient.createMemo({ memo });
            created++;
          } catch (error) {
            failed++;
            console.error("bookmark import failed", row.url, error);
          }
          setProgress((previous) => ({ ...previous, created, failed }));
        }
      };

      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pending.length) }, worker));

      // Single invalidation at the end — the loop bypasses React Query on purpose.
      await queryClient.invalidateQueries({ queryKey: memoKeys.lists() });
      await queryClient.invalidateQueries({ queryKey: userKeys.stats() });
      await queryClient.invalidateQueries({ queryKey: attachmentKeys.lists() });

      setProgress((previous) => ({ ...previous, status: "done" }));
    },
    [queryClient],
  );

  return { progress, start, cancel, reset };
}
