import { useState } from "react";
import useDebounce from "react-use/lib/useDebounce";
import { memoServiceClient } from "@/grpcweb";
import { DEFAULT_LIST_MEMOS_PAGE_SIZE } from "@/helpers/consts";
import useCurrentUser from "@/hooks/useCurrentUser";
import { extractUserIdFromName } from "@/store/common";
import { Memo, MemoRelation, MemoRelation_Memo, MemoRelation_Type } from "@/types/proto/api/v1/memo_service";

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
        const conditions = [`creator_id == ${extractUserIdFromName(user.name)}`];
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
    const relation = MemoRelation.fromPartial({
      type: MemoRelation_Type.REFERENCE,
      relatedMemo: MemoRelation_Memo.fromPartial({
        name: memo.name,
        snippet: memo.snippet,
      }),
    });
    onAddRelation(relation);
  };

  const getHighlightedContent = (content: string): React.ReactNode => {
    if (!searchText) return content;

    const index = content.toLowerCase().indexOf(searchText.toLowerCase());
    if (index === -1) {
      return content;
    }

    let before = content.slice(0, index);
    if (before.length > 20) {
      before = "..." + before.slice(before.length - 20);
    }
    const highlighted = content.slice(index, index + searchText.length);
    let after = content.slice(index + searchText.length);
    if (after.length > 20) {
      after = after.slice(0, 20) + "...";
    }

    return (
      <>
        {before}
        <mark className="font-medium">{highlighted}</mark>
        {after}
      </>
    );
  };

  return {
    searchText,
    setSearchText,
    isFetching,
    filteredMemos,
    addMemoRelation,
    getHighlightedContent,
  };
};
