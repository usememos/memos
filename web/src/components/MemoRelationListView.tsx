import clsx from "clsx";
import { DotIcon, LinkIcon, MilestoneIcon } from "lucide-react";
import { memo, useState } from "react";
import { Link } from "react-router-dom";
import useAsyncEffect from "@/hooks/useAsyncEffect";
import { useMemoStore } from "@/store/v1";
import { MemoRelation } from "@/types/proto/api/v1/memo_relation_service";
import { Memo } from "@/types/proto/api/v1/memo_service";

interface Props {
  memo: Memo;
  relations: MemoRelation[];
}

const MemoRelationListView = (props: Props) => {
  const { memo, relations: relationList } = props;
  const memoStore = useMemoStore();
  const [referencingMemoList, setReferencingMemoList] = useState<Memo[]>([]);
  const [referencedMemoList, setReferencedMemoList] = useState<Memo[]>([]);
  const [selectedTab, setSelectedTab] = useState<"referencing" | "referenced">("referencing");

  useAsyncEffect(async () => {
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
    if (referencingMemoList.length === 0) {
      setSelectedTab("referenced");
    } else {
      setSelectedTab("referencing");
    }
  }, [memo.name, relationList]);

  if (referencingMemoList.length + referencedMemoList.length === 0) {
    return null;
  }

  return (
    <div className="relative flex flex-col justify-start items-start w-full px-2 pt-2 pb-1.5 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700">
      <div className="w-full flex flex-row justify-start items-center mb-1 gap-3 opacity-60">
        {referencingMemoList.length > 0 && (
          <button
            className={clsx(
              "w-auto flex flex-row justify-start items-center text-xs gap-0.5 text-gray-500",
              selectedTab === "referencing" && "text-gray-800 dark:text-gray-400",
            )}
            onClick={() => setSelectedTab("referencing")}
          >
            <LinkIcon className="w-3 h-auto shrink-0 opacity-70" />
            <span>Referencing</span>
            <span className="opacity-80">({referencingMemoList.length})</span>
          </button>
        )}
        {referencedMemoList.length > 0 && (
          <button
            className={clsx(
              "w-auto flex flex-row justify-start items-center text-xs gap-0.5 text-gray-500",
              selectedTab === "referenced" && "text-gray-800 dark:text-gray-400",
            )}
            onClick={() => setSelectedTab("referenced")}
          >
            <MilestoneIcon className="w-3 h-auto shrink-0 opacity-70" />
            <span>Referenced by</span>
            <span className="opacity-80">({referencedMemoList.length})</span>
          </button>
        )}
      </div>
      {selectedTab === "referencing" && referencingMemoList.length > 0 && (
        <div className="w-full flex flex-col justify-start items-start">
          {referencingMemoList.map((memo) => {
            return (
              <Link
                key={memo.name}
                className="w-auto max-w-full flex flex-row justify-start items-center text-sm leading-5 text-gray-600 dark:text-gray-400 dark:border-zinc-700 dark:bg-zinc-900 hover:underline"
                to={`/m/${memo.uid}`}
                unstable_viewTransition
              >
                <DotIcon className="shrink-0 w-4 h-auto opacity-40" />
                <span className="truncate">{memo.snippet}</span>
              </Link>
            );
          })}
        </div>
      )}
      {selectedTab === "referenced" && referencedMemoList.length > 0 && (
        <div className="w-full flex flex-col justify-start items-start">
          {referencedMemoList.map((memo) => {
            return (
              <Link
                key={memo.name}
                className="w-auto max-w-full flex flex-row justify-start items-center text-sm leading-5 text-gray-600 dark:text-gray-400 dark:border-zinc-700 dark:bg-zinc-900 hover:underline"
                to={`/m/${memo.uid}`}
                unstable_viewTransition
              >
                <DotIcon className="shrink-0 w-4 h-auto opacity-40" />
                <span className="truncate">{memo.snippet}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default memo(MemoRelationListView);
