import { create } from "@bufbuild/protobuf";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { findMemoInCollectionQueries, memoDetailQueryOptions } from "@/hooks/useMemoQueries";
import { type MemoRelation_Memo, MemoRelation_MemoSchema } from "@/types/proto/api/v1/memo_service_pb";

export const useResolvedRelationMemos = (memoNames: string[], options?: { enabled?: boolean }) => {
  const client = useQueryClient();
  const names = Array.from(new Set(memoNames.filter(Boolean)));
  const queries = useQueries({
    queries: names.map((name) => ({
      ...memoDetailQueryOptions(name),
      enabled: options?.enabled ?? true,
      initialData: () => findMemoInCollectionQueries(client, name, true),
    })),
  });
  const resolved: Record<string, MemoRelation_Memo | null> = {};
  queries.forEach((query, index) => {
    if (query.data === null) resolved[names[index]] = null;
    else if (query.data) {
      resolved[names[index]] = create(MemoRelation_MemoSchema, { name: query.data.name, snippet: query.data.snippet });
    }
  });
  return resolved;
};
