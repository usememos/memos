import { Tooltip } from "@mui/joy";
import { memo, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMemoStore } from "@/store/v1";
import { MemoRelation } from "@/types/proto/api/v1/memo_relation_service";
import { Memo } from "@/types/proto/api/v1/memo_service";
import Icon from "./Icon";

interface Props {
  memo: Memo;
  relations: MemoRelation[];
}

const MemoRelationListView = (props: Props) => {
  const { memo, relations: relationList } = props;
  const memoStore = useMemoStore();
  const [referencingMemoList, setReferencingMemoList] = useState<Memo[]>([]);
  const [referencedMemoList, setReferencedMemoList] = useState<Memo[]>([]);

  useEffect(() => {
    (async () => {
      const referencingMemoList = await Promise.all(
        relationList
          .filter((relation) => relation.memo === memo.name && relation.relatedMemo !== memo.name)
          .map((relation) => memoStore.getOrFetchMemoByName(relation.relatedMemo, { skipStore: true })),
      );
      setReferencingMemoList(referencingMemoList);
      const referencedMemoList = await Promise.all(
        relationList
          .filter((relation) => relation.memo !== memo.name && relation.relatedMemo === memo.name)
          .map((relation) => memoStore.getOrFetchMemoByName(relation.memo, { skipStore: true })),
      );
      setReferencedMemoList(referencedMemoList);
    })();
  }, [memo, relationList]);

  return (
    <>
      {referencingMemoList.length > 0 && (
        <div className="w-full flex flex-row justify-start items-center flex-wrap gap-2">
          {referencingMemoList.map((memo) => {
            return (
              <div key={memo.name} className="block w-auto max-w-[50%]">
                <Link
                  className="px-2 border rounded-md w-auto text-sm leading-6 flex flex-row justify-start items-center flex-nowrap text-gray-600 dark:text-gray-400 dark:border-zinc-700 dark:bg-zinc-900 hover:shadow hover:opacity-80"
                  to={`/m/${memo.uid}`}
                  unstable_viewTransition
                >
                  <Tooltip title="Reference" placement="top">
                    <Icon.Link className="w-4 h-auto shrink-0 opacity-70" />
                  </Tooltip>
                  <span className="truncate ml-1">{memo.content}</span>
                </Link>
              </div>
            );
          })}
        </div>
      )}
      {referencedMemoList.length > 0 && (
        <div className="w-full flex flex-row justify-start items-center flex-wrap gap-2">
          {referencedMemoList.map((memo) => {
            return (
              <div key={memo.name} className="block w-auto max-w-[50%]">
                <Link
                  className="px-2 border rounded-md w-auto text-sm leading-6 flex flex-row justify-start items-center flex-nowrap text-gray-600 dark:text-gray-400 dark:border-zinc-700 dark:bg-zinc-900 hover:shadow hover:opacity-80"
                  to={`/m/${memo.uid}`}
                  unstable_viewTransition
                >
                  <Tooltip title="Backlink" placement="top">
                    <Icon.Milestone className="w-4 h-auto shrink-0 opacity-70" />
                  </Tooltip>
                  <span className="truncate ml-1">{memo.content}</span>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};

export default memo(MemoRelationListView);
