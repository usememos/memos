import { create } from "@bufbuild/protobuf";
import { useState } from "react";
import useDebounce from "react-use/lib/useDebounce";
import { memoServiceClient } from "@/connect";
import { DEFAULT_LIST_MEMOS_PAGE_SIZE } from "@/helpers/consts";
import { extractUserIdFromName } from "@/helpers/resource-names";
import useCurrentUser from "@/hooks/useCurrentUser";
import { Memo, MemoRelation, MemoRelation_MemoSchema, MemoRelation_Type, MemoRelationSchema } from "@/types/proto/api/v1/memo_service_pb";

interface UseLinkMemoParams {
  isOpen: boolean;
  currentMemoName?: string;
  existingRelations: MemoRelation[];
  onAddRelation: (relation: MemoRelation) => void;
}

export const useLinkMemo = ({ isOpen, currentMemoName, existingRelations, onAddRelation }: UseLinkMemoParams) => {
  const user = useCurrentUser();
  const [searchText, setSearchText] = useState("");
  const [isFetching, setIsFetching] = useState(true);
  const [fetchedMemos, setFetchedMemos] = useState<Memo[]>([]);

  const filteredMemos = fetchedMemos.filter(
    (memo) => memo.name !== currentMemoName && !existingRelations.some((relation) => relation.relatedMemo?.name === memo.name),
  );

  useDebounce(
    async () => {
      if (!isOpen) return;

      setIsFetching(true);
      try {
        const conditions = [`creator_id == ${extractUserIdFromName(user?.name ?? "")}`];
        if (searchText) {
          conditions.push(`content.contains("${searchText}")`);
        }
        const { memos } = await memoServiceClient.listMemos({
          pageSize: DEFAULT_LIST_MEMOS_PAGE_SIZE,
          filter: conditions.join(" && "),
        });
        setFetchedMemos(memos);
      } catch (error) {
        console.error(error);
      } finally {
        setIsFetching(false);
      }
    },
    300,
    [isOpen, searchText],
  );

  const addMemoRelation = (memo: Memo) => {
    const relation = create(MemoRelationSchema, {
      type: MemoRelation_Type.REFERENCE,
      relatedMemo: create(MemoRelation_MemoSchema, {
        name: memo.name,
        snippet: memo.snippet,
      }),
    });
    onAddRelation(relation);
  };

  return {
    searchText,
    setSearchText,
    isFetching,
    filteredMemos,
    addMemoRelation,
  };
};
