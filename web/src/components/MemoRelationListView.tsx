import { memo, useEffect, useState } from "react";
import { useMemoStore } from "@/store/v1";
import { MemoRelation } from "@/types/proto/api/v1/memo_relation_service";
import { Memo } from "@/types/proto/api/v1/memo_service";
import EmbeddedContent from "./MemoContent/EmbeddedContent";

interface Props {
  memo: Memo;
  relations: MemoRelation[];
}

const MemoRelationListView = (props: Props) => {
  const { memo, relations: relationList } = props;
  const memoStore = useMemoStore();
  const [referencingMemoList, setReferencingMemoList] = useState<Memo[]>([]);

  useEffect(() => {
    (async () => {
      const referencingMemoList = await Promise.all(
        relationList
          .filter((relation) => relation.memo === memo.name && relation.relatedMemo !== memo.name)
          .map((relation) => memoStore.getOrFetchMemoByName(relation.relatedMemo, { skipStore: true })),
      );
      setReferencingMemoList(referencingMemoList);
    })();
  }, [memo, relationList]);

  return (
    referencingMemoList.length > 0 && (
      <div className="w-full flex flex-row justify-start items-center flex-wrap gap-2">
        {referencingMemoList.map((memo) => {
          return <EmbeddedContent key={memo.uid} resourceName={`memos/${memo.uid}`} params={"snippet"} />;
        })}
      </div>
    )
  );
};

export default memo(MemoRelationListView);
