import { useEffect, useState } from "react";
import { useMemoCacheStore } from "@/store/zustand";
import Icon from "./Icon";

interface Props {
  relationList: MemoRelation[];
}

const MemoRelationListView = (props: Props) => {
  const memoCacheStore = useMemoCacheStore();
  const [relatedMemoList, setRelatedMemoList] = useState<Memo[]>([]);
  const relationList = props.relationList;

  useEffect(() => {
    const fetchRelatedMemoList = async () => {
      const memoList = await Promise.all(relationList.map((relation) => memoCacheStore.getOrFetchMemoById(relation.relatedMemoId)));
      setRelatedMemoList(memoList);
    };

    fetchRelatedMemoList();
  }, [relationList]);

  const handleGotoMemoDetail = (memo: Memo) => {
    window.open(`/m/${memo.id}`, "_blank");
  };

  return (
    <>
      {relatedMemoList.length > 0 && (
        <div className="w-full max-w-full overflow-hidden grid grid-cols-1 gap-1 mt-2">
          {relatedMemoList.map((memo) => {
            return (
              <div
                key={memo.id}
                className="w-auto flex flex-row justify-start items-center hover:bg-gray-100 dark:hover:bg-zinc-800 rounded text-sm p-1 text-gray-500 dark:text-gray-400 cursor-pointer"
                onClick={() => handleGotoMemoDetail(memo)}
              >
                <div className="w-5 h-5 flex justify-center items-center shrink-0 bg-gray-100 dark:bg-zinc-800 rounded-full">
                  <Icon.Link className="w-3 h-auto" />
                </div>
                <span className="mx-1 w-auto truncate">{memo.content}</span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};

export default MemoRelationListView;
