import { LinkIcon, MilestoneIcon } from "lucide-react";
import { memo, useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { extractMemoIdFromName } from "@/store/common";
import { Memo, MemoRelation } from "@/types/proto/api/v1/memo_service";
import { useTranslate } from "@/utils/i18n";

interface Props {
  memo: Memo;
  relations: MemoRelation[];
  parentPage?: string;
}

const MemoRelationListView = (props: Props) => {
  const t = useTranslate();
  const { memo, relations: relationList, parentPage } = props;
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
    <div className="relative flex flex-col justify-start items-start w-full px-2 pt-2 pb-1.5 bg-muted/50 rounded-lg border border-border">
      <div className="w-full flex flex-row justify-start items-center mb-1 gap-3 opacity-60">
        {referencingMemoList.length > 0 && (
          <button
            className={cn(
              "w-auto flex flex-row justify-start items-center text-xs gap-0.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded px-1 py-0.5 transition-colors",
              selectedTab === "referencing" && "text-foreground bg-accent",
            )}
            onClick={() => setSelectedTab("referencing")}
          >
            <LinkIcon className="w-3 h-auto shrink-0 opacity-70" />
            <span>{t("common.referencing")}</span>
            <span className="opacity-80">({referencingMemoList.length})</span>
          </button>
        )}
        {referencedMemoList.length > 0 && (
          <button
            className={cn(
              "w-auto flex flex-row justify-start items-center text-xs gap-0.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded px-1 py-0.5 transition-colors",
              selectedTab === "referenced" && "text-foreground bg-accent",
            )}
            onClick={() => setSelectedTab("referenced")}
          >
            <MilestoneIcon className="w-3 h-auto shrink-0 opacity-70" />
            <span>{t("common.referenced-by")}</span>
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
                className="w-full flex flex-row justify-start items-center text-sm leading-5 text-muted-foreground hover:text-foreground hover:bg-accent rounded px-2 py-1 transition-colors"
                to={`/${memo.name}`}
                viewTransition
                state={{
                  from: parentPage,
                }}
              >
                <span className="text-xs opacity-60 leading-4 border border-border font-mono px-1 rounded-full mr-1">
                  {extractMemoIdFromName(memo.name).slice(0, 6)}
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
                className="w-full flex flex-row justify-start items-center text-sm leading-5 text-muted-foreground hover:text-foreground hover:bg-accent rounded px-2 py-1 transition-colors"
                to={`/${memo.name}`}
                viewTransition
                state={{
                  from: parentPage,
                }}
              >
                <span className="text-xs opacity-60 leading-4 border border-border font-mono px-1 rounded-full mr-1">
                  {extractMemoIdFromName(memo.name).slice(0, 6)}
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
