import { create } from "@bufbuild/protobuf";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { findMemoInCollectionQueries, memoDetailQueryOptions } from "@/hooks/useMemoQueries";
import { MemoRelation_Memo, MemoRelation_MemoSchema } from "@/types/proto/api/v1/memo_service_pb";

export const useResolvedRelationMemos = (memoNames: string[]) => {
  const queryClient = useQueryClient();
  const [resolvedMemos, setResolvedMemos] = useState<Record<string, MemoRelation_Memo>>({});

  const missingMemoNames = useMemo(() => {
    return Array.from(new Set(memoNames)).filter((name) => name && !resolvedMemos[name]);
  }, [memoNames, resolvedMemos]);

  useEffect(() => {
    if (missingMemoNames.length === 0) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const memos = await Promise.all(
          missingMemoNames.map(async (name) => {
            const memo = findMemoInCollectionQueries(queryClient, name) ?? (await queryClient.fetchQuery(memoDetailQueryOptions(name)));
            return create(MemoRelation_MemoSchema, { name: memo.name, snippet: memo.snippet });
          }),
        );

        if (cancelled) {
          return;
        }

        setResolvedMemos((prev) => {
          const next = { ...prev };
          for (const memo of memos) {
            next[memo.name] = memo;
          }
          return next;
        });
      } catch {
        // Keep existing relation data when snippet hydration fails.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [missingMemoNames, queryClient]);

  return resolvedMemos;
};
