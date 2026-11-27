import { create } from "@bufbuild/protobuf";
import { timestampDate } from "@bufbuild/protobuf/wkt";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { findMemoInCollectionQueries, memoDetailQueryOptions } from "@/hooks/useMemoQueries";
import { type MemoRelation_MemoRef, MemoRelation_MemoRefSchema } from "@/types/proto/api/memo_service_pb";
import { formatRelationDate } from "./relationHelpers";

const useRelationMemoQueries = (memoNames: string[], options?: { enabled?: boolean }) => {
  const client = useQueryClient();
  const names = Array.from(new Set(memoNames.filter(Boolean)));
  const queries = useQueries({
    queries: names.map((name) => ({
      ...memoDetailQueryOptions(name),
      enabled: options?.enabled ?? true,
      initialData: () => findMemoInCollectionQueries(client, name, true),
    })),
  });
  return { names, queries };
};

export const useResolvedRelationMemos = (memoNames: string[], options?: { enabled?: boolean }) => {
  const { names, queries } = useRelationMemoQueries(memoNames, options);
  const resolved: Record<string, MemoRelation_MemoRef | null> = {};
  queries.forEach((query, index) => {
    if (query.data === null) resolved[names[index]] = null;
    else if (query.data) {
      resolved[names[index]] = create(MemoRelation_MemoRefSchema, { name: query.data.name, snippet: query.data.snippet });
    }
  });
  return resolved;
};

/**
 * Each related memo's date for its row, formatted for the reader's language. It reads the same
 * queries as {@link useResolvedRelationMemos}, so it adds no requests of its own.
 */
export const useRelationMemoDates = (memoNames: string[], options?: { enabled?: boolean }) => {
  const { i18n } = useTranslation();
  const { names, queries } = useRelationMemoQueries(memoNames, options);
  const dates: Record<string, string | undefined> = {};
  queries.forEach((query, index) => {
    if (query.data?.createTime) dates[names[index]] = formatRelationDate(timestampDate(query.data.createTime), i18n.language);
  });
  return dates;
};
