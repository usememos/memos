import { Tooltip } from "@mui/joy";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMemoCacheStore } from "@/store/v1";
import Icon from "./Icon";

interface Props {
  memo: Memo;
  relationList: MemoRelation[];
}

const MemoRelationListView = (props: Props) => {
  const { memo, relationList } = props;
  const memoCacheStore = useMemoCacheStore();
  const [referencingMemoList, setReferencingMemoList] = useState<Memo[]>([]);
  const [referencedMemoList, setReferencedMemoList] = useState<Memo[]>([]);

  useEffect(() => {
    (async () => {
      const referencingMemoList = await Promise.all(
        relationList
          .filter((relation) => relation.memoId === memo.id && relation.relatedMemoId !== memo.id)
          .map((relation) => memoCacheStore.getOrFetchMemoById(relation.relatedMemoId))
      );
      setReferencingMemoList(referencingMemoList);
      const referencedMemoList = await Promise.all(
        relationList
          .filter((relation) => relation.memoId !== memo.id && relation.relatedMemoId === memo.id)
          .map((relation) => memoCacheStore.getOrFetchMemoById(relation.memoId))
      );
      setReferencedMemoList(referencedMemoList);
    })();
  }, [memo, relationList]);

  return (
    <>
      {referencingMemoList.length > 0 && (
        <div className="w-full mt-2 flex flex-row justify-start items-center flex-wrap gap-2">
          {referencingMemoList.map((memo) => {
            return (
              <div key={memo.id} className="block w-auto max-w-[50%]">
                <Link
                  className="px-2 border rounded-full w-auto text-sm leading-6 flex flex-row justify-start items-center flex-nowrap text-gray-600 dark:text-gray-300 dark:border-gray-600 hover:shadow hover:opacity-80"
                  to={`/m/${memo.id}`}
                >
                  <Tooltip title="Reference" placement="top">
                    <Icon.Link className="w-4 h-auto shrink-0 opacity-70" />
                  </Tooltip>
                  <span className="opacity-70 mx-1">#{memo.id}</span>
                  <span className="truncate">{memo.content}</span>
                </Link>
              </div>
            );
          })}
        </div>
      )}
      {referencedMemoList.length > 0 && (
        <div className="w-full mt-2 flex flex-row justify-start items-center flex-wrap gap-2">
          {referencedMemoList.map((memo) => {
            return (
              <div key={memo.id} className="block w-auto max-w-[50%]">
                <Link
                  className="px-2 border rounded-full w-auto text-sm leading-6 flex flex-row justify-start items-center flex-nowrap text-gray-600 dark:text-gray-300 dark:border-gray-600 hover:shadow hover:opacity-80"
                  to={`/m/${memo.id}`}
                >
                  <Tooltip title="Backlink" placement="top">
                    <Icon.Milestone className="w-4 h-auto shrink-0 opacity-70" />
                  </Tooltip>
                  <span className="opacity-70 mx-1">#{memo.id}</span>
                  <span className="truncate">{memo.content}</span>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};

export default MemoRelationListView;
