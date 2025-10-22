import { LinkIcon, XIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { memoStore } from "@/store";
import { Memo, MemoRelation, MemoRelation_Type } from "@/types/proto/api/v1/memo_service";

interface Props {
  relationList: MemoRelation[];
  setRelationList: (relationList: MemoRelation[]) => void;
}

const RelationListView = observer((props: Props) => {
  const { relationList, setRelationList } = props;
  const [referencingMemoList, setReferencingMemoList] = useState<Memo[]>([]);

  useEffect(() => {
    (async () => {
      const requests = relationList
        .filter((relation) => relation.type === MemoRelation_Type.REFERENCE)
        .map(async (relation) => {
          return await memoStore.getOrFetchMemoByName(relation.relatedMemo!.name, { skipStore: true });
        });
      const list = await Promise.all(requests);
      setReferencingMemoList(list);
    })();
  }, [relationList]);

  const handleDeleteRelation = async (memo: Memo) => {
    setRelationList(relationList.filter((relation) => relation.relatedMemo?.name !== memo.name));
  };

  return (
    <>
      {referencingMemoList.length > 0 && (
        <div className="w-full flex flex-row gap-2 mt-2 flex-wrap">
          {referencingMemoList.map((memo) => {
            return (
              <div
                key={memo.name}
                className="w-auto max-w-xs overflow-hidden flex flex-row justify-start items-center bg-muted hover:opacity-80 rounded-md text-sm p-1 px-2 text-muted-foreground cursor-pointer hover:line-through"
                onClick={() => handleDeleteRelation(memo)}
              >
                <LinkIcon className="w-4 h-auto shrink-0 opacity-80" />
                <span className="mx-1 max-w-full text-ellipsis whitespace-nowrap overflow-hidden">{memo.snippet}</span>
                <XIcon className="w-4 h-auto cursor-pointer shrink-0 opacity-60 hover:opacity-100" />
              </div>
            );
          })}
        </div>
      )}
    </>
  );
});

export default RelationListView;
