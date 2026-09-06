import { create } from "@bufbuild/protobuf";
import { useQueryClient } from "@tanstack/react-query";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";
import { normalizeIdentifier } from "micromark-util-normalize-identifier";
import { useCallback, useEffect, useRef, useState } from "react";
import { visit } from "unist-util-visit";
import { memoServiceClient } from "@/connect";
import { useSpaceContext } from "@/contexts/SpaceContext";
import { attachmentKeys } from "@/hooks/useAttachmentQueries";
import useCurrentUser from "@/hooks/useCurrentUser";
import { memoKeys } from "@/hooks/useMemoQueries";
import { userKeys } from "@/hooks/useUserQueries";
import { buildBookmarkContent, normalizeBookmarkUrl } from "@/lib/bookmark";
import { buildMemoCreatorFilter } from "@/lib/resource-names";
import { State } from "@/types/proto/api/v1/common_pb";
import { ListMemosRequestSchema, MemoSchema } from "@/types/proto/api/v1/memo_service_pb";
import type { RaindropRow } from "./csv";
import { slugifyTag } from "./slugifyTag";

export interface ImportProgress {
  status: "idle" | "deduping" | "importing" | "cancelling" | "cancelled" | "error" | "done";
  total: number;
  created: number;
  skipped: number;
  failed: number;
}

const INITIAL_PROGRESS: ImportProgress = { status: "idle", total: 0, created: 0, skipped: 0, failed: 0 };
const CONCURRENCY = 3;

const importErrorCategory = (error: unknown): string => {
  if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
  return "request_failed";
};

async function collectExistingUrlsForState(creator: string, state: State, signal: AbortSignal, urls: Set<string>): Promise<void> {
  let pageToken = "";
  for (;;) {
    signal.throwIfAborted();
    const response = await memoServiceClient.listMemos(
      create(ListMemosRequestSchema, {
        filter: `has_link && ${buildMemoCreatorFilter(creator)}`,
        pageSize: 200,
        pageToken,
        state,
        orderBy: "id asc",
      }),
      { signal },
    );
    signal.throwIfAborted();
    for (const memo of response.memos) {
      for (const link of memo.property?.links ?? []) {
        if (link.url) {
          urls.add(normalizeBookmarkUrl(link.url));
        }
      }
      const tree = fromMarkdown(memo.content, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] });
      const definitions = new Map<string, string>();
      visit(tree, "definition", (node) => {
        const identifier = normalizeIdentifier(node.identifier);
        if (!definitions.has(identifier)) definitions.set(identifier, node.url);
      });
      visit(tree, (node) => {
        const url =
          node.type === "link"
            ? node.url
            : node.type === "linkReference"
              ? definitions.get(normalizeIdentifier(node.identifier))
              : undefined;
        if (url) urls.add(normalizeBookmarkUrl(url));
      });
    }
    pageToken = response.nextPageToken;
    if (!pageToken) break;
  }
}

async function collectExistingUrls(creator: string, signal: AbortSignal): Promise<Set<string>> {
  const urls = new Set<string>();
  await collectExistingUrlsForState(creator, State.NORMAL, signal, urls);
  await collectExistingUrlsForState(creator, State.ARCHIVED, signal, urls);
  return urls;
}

export function buildMemoContent(row: RaindropRow): string {
  const tags = [slugifyTag(row.folder), ...row.tags.map((tag) => tag.replace(/[^\p{L}\p{N}+-]/gu, ""))].filter(Boolean);
  const parts = [buildBookmarkContent(row.url, row.title || row.url, [])];
  if (tags.length > 0) parts.push(tags.map((tag) => `#${tag}`).join(" "));
  const note = [row.note, row.highlights].filter(Boolean).join("\n\n");
  if (note) {
    parts.push(note);
  }
  return parts.join("\n\n");
}

export function useBookmarkImport() {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<ImportProgress>(INITIAL_PROGRESS);
  const user = useCurrentUser();
  const { selectedSpaceName } = useSpaceContext();
  const activeRun = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      activeRun.current?.abort();
      activeRun.current = null;
    },
    [],
  );

  const reset = useCallback(() => {
    activeRun.current?.abort();
    activeRun.current = null;
    setProgress(INITIAL_PROGRESS);
  }, []);

  const cancel = useCallback(() => {
    activeRun.current?.abort();
    if (activeRun.current) setProgress((previous) => ({ ...previous, status: "cancelling" }));
  }, []);

  const start = useCallback(
    async (rows: RaindropRow[]) => {
      if (activeRun.current) return;
      if (!user?.name) {
        setProgress({ ...INITIAL_PROGRESS, status: "error" });
        return;
      }
      const run = new AbortController();
      activeRun.current = run;
      setProgress({ ...INITIAL_PROGRESS, status: "deduping", total: rows.length });

      let existing: Set<string>;
      try {
        existing = await collectExistingUrls(user.name, run.signal);
      } catch (error) {
        if (activeRun.current === run) {
          activeRun.current = null;
          setProgress((previous) => ({ ...previous, status: run.signal.aborted ? "cancelled" : "error" }));
        }
        if (!run.signal.aborted) console.error(`bookmark import dedupe failed: ${importErrorCategory(error)}`);
        return;
      }

      if (activeRun.current !== run) return;
      const pending = rows.filter((row) => {
        const url = normalizeBookmarkUrl(row.url);
        if (existing.has(url)) return false;
        existing.add(url);
        return true;
      });
      const skipped = rows.length - pending.length;
      setProgress({ ...INITIAL_PROGRESS, status: "importing", total: rows.length, skipped });

      let created = 0;
      let failed = 0;
      let next = 0;

      const worker = async () => {
        for (;;) {
          if (run.signal.aborted) return;
          const index = next++;
          if (index >= pending.length) return;
          const row = pending[index];
          try {
            const memo = create(MemoSchema, { content: buildMemoContent(row), space: selectedSpaceName });
            await memoServiceClient.createMemo({ memo });
            created++;
          } catch (error) {
            failed++;
            console.error(`bookmark import row ${index + 1} failed: ${importErrorCategory(error)}`);
          }
          if (activeRun.current === run) setProgress((previous) => ({ ...previous, created, failed }));
        }
      };

      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pending.length) }, worker));

      // Single invalidation at the end — the loop bypasses React Query on purpose.
      await queryClient.invalidateQueries({ queryKey: memoKeys.lists() });
      await queryClient.invalidateQueries({ queryKey: userKeys.stats() });
      await queryClient.invalidateQueries({ queryKey: attachmentKeys.lists() });

      if (activeRun.current === run) {
        activeRun.current = null;
        setProgress((previous) => ({ ...previous, status: run.signal.aborted ? "cancelled" : "done" }));
      }
    },
    [queryClient, user?.name, selectedSpaceName],
  );

  return { progress, start, cancel, reset };
}
