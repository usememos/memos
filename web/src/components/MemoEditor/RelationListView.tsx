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
                className="group relative inline-flex items-center gap-1.5 px-2 h-7 rounded-md border border-border bg-background text-secondary-foreground text-xs transition-colors hover:bg-accent cursor-pointer"
                onClick={() => handleDeleteRelation(memo)}
              >
                <LinkIcon className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate max-w-[160px]">{memo.snippet}</span>
                <XIcon className="w-3 h-3 shrink-0 text-muted-foreground" />
              </div>
            );
          })}
        </div>
      )}
    </>
  );
});

export default RelationListView;
