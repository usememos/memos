import { useEffect, useState } from "react";
import { useMemoCacheStore } from "@/store/v1";
import Icon from "../Icon";

interface Props {
  relationList: MemoRelation[];
  setRelationList: (relationList: MemoRelation[]) => void;
}

const RelationListView = (props: Props) => {
  const { relationList, setRelationList } = props;
  const memoCacheStore = useMemoCacheStore();
  const [referencingMemoList, setReferencingMemoList] = useState<Memo[]>([]);

  useEffect(() => {
    (async () => {
      const requests = relationList
        .filter((relation) => relation.type === "REFERENCE")
        .map(async (relation) => {
          return await memoCacheStore.getOrFetchMemoById(relation.relatedMemoId);
        });
      const list = await Promise.all(requests);
      setReferencingMemoList(list);
    })();
  }, [relationList]);

  const handleDeleteRelation = async (memo: Memo) => {
    setRelationList(relationList.filter((relation) => relation.relatedMemoId !== memo.id));
  };

  console.log("referencingMemoList", referencingMemoList);

  return (
    <>
      {referencingMemoList.length > 0 && (
        <div className="w-full flex flex-row gap-2 mt-2 flex-wrap">
          {referencingMemoList.map((memo) => {
            return (
              <div
                key={memo.id}
                className="w-auto max-w-xs overflow-hidden flex flex-row justify-start items-center bg-gray-100 dark:bg-zinc-800 hover:opacity-80 rounded text-sm p-1 px-2 text-gray-500 cursor-pointer hover:line-through"
                onClick={() => handleDeleteRelation(memo)}
              >
                <Icon.Link className="w-4 h-auto shrink-0 opacity-80" />
                <span className="px-1 shrink-0 opacity-80">#{memo.id}</span>
                <span className="max-w-full text-ellipsis whitespace-nowrap overflow-hidden">{memo.content}</span>
                <Icon.X className="w-4 h-auto hover:opacity-80 shrink-0 ml-1" />
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};

export default RelationListView;
