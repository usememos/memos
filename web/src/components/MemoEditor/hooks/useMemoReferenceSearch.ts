import { useCallback } from "react";
import type { MemoReferenceCandidate, MemoReferenceSearch } from "@/components/MemoEditor/Editor/memoAutocomplete";
import { memoServiceClient } from "@/connect";
import useCurrentUser from "@/hooks/useCurrentUser";
import { buildMemoCreatorFilter, extractMemoIdFromName } from "@/lib/resource-names";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";

/** Enough candidates to choose from without turning the popup into a memo list. */
const CANDIDATE_LIMIT = 8;
/** A popup row is one line, so a long first paragraph is cut rather than wrapped. */
const SNIPPET_LIMIT = 80;

/** The memo's first line, collapsed to fit a single popup row. */
const toSnippet = (memo: Memo): string => {
  const text = (memo.snippet || memo.content).replace(/\s+/gu, " ").trim();
  return text.length > SNIPPET_LIMIT ? `${text.slice(0, SNIPPET_LIMIT)}…` : text;
};

/**
 * Backs the editor's `@` picker. Only the author's own memos are offered —
 * referencing a memo you cannot read would produce a link that resolves to
 * nothing, since the server drops references it cannot grant the author.
 */
export const useMemoReferenceSearch = (): MemoReferenceSearch => {
  const user = useCurrentUser();

  return useCallback(
    async (query: string): Promise<MemoReferenceCandidate[]> => {
      const conditions: string[] = [];
      const creatorFilter = buildMemoCreatorFilter(user?.name ?? "");
      if (creatorFilter) conditions.push(creatorFilter);
      // JSON quoting escapes the quotes and backslashes a memo search can contain.
      if (query) conditions.push(`content.contains(${JSON.stringify(query)})`);

      const { memos } = await memoServiceClient.listMemos({
        pageSize: CANDIDATE_LIMIT,
        filter: conditions.join(" && "),
      });
      return memos.map((memo) => ({ uid: extractMemoIdFromName(memo.name), snippet: toSnippet(memo) }));
    },
    [user?.name],
  );
};
