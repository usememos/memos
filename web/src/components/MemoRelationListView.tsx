import clsx from "clsx";
import { LinkIcon, MilestoneIcon } from "lucide-react";
import { memo, useState } from "react";
import { Link } from "react-router-dom";
import { MemoRelation } from "@/types/proto/api/v1/memo_relation_service";
import { Memo } from "@/types/proto/api/v1/memo_service";

interface Props {
  memo: Memo;
  relations: MemoRelation[];
}

const MemoRelationListView = (props: Props) => {
  const { memo, relations: relationList } = props;
  const referencingMemoList = relationList
    .filter((relation) => relation.memo?.name === memo.name && relation.relatedMemo?.name !== memo.name)
    .map((relation) => relation.relatedMemo!);
  const referencedMemoList = relationList
    .filter((relation) => relation.memo?.name !== memo.name && relation.relatedMemo?.name === memo.name)
    .map((relation) => relation.memo!);
  const [selectedTab, setSelectedTab] = useState<"referencing" | "referenced">(
    referencingMemoList.length === 0 ? "referenced" : "referencing",
  );

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
                viewTransition
              >
                <span className="text-xs opacity-60 leading-4 border font-mono px-1 rounded-full mr-1 dark:border-zinc-700">
                  {memo.uid.slice(0, 6)}
                </span>
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
                viewTransition
              >
                <span className="text-xs opacity-60 leading-4 border font-mono px-1 rounded-full mr-1 dark:border-zinc-700">
                  {memo.uid.slice(0, 6)}
                </span>
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
