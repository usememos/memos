import { isEqual } from "lodash-es";
import { CheckCircleIcon, Code2Icon, HashIcon, LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Memo, MemoRelation_Type, Memo_Property } from "@/types/proto/api/v1/memo_service";
import { useTranslate } from "@/utils/i18n";
import MemoRelationForceGraph from "../MemoRelationForceGraph";

interface Props {
  memo: Memo;
  className?: string;
  parentPage?: string;
}

const MemoDetailSidebar = ({ memo, className, parentPage }: Props) => {
  const t = useTranslate();
  const property = Memo_Property.fromPartial(memo.property || {});
  const hasSpecialProperty = property.hasLink || property.hasTaskList || property.hasCode || property.hasIncompleteTasks;
  const shouldShowRelationGraph = memo.relations.filter((r) => r.type === MemoRelation_Type.REFERENCE).length > 0;

  return (
    <aside
      className={cn("relative w-full h-auto max-h-screen overflow-auto hide-scrollbar flex flex-col justify-start items-start", className)}
    >
      <div className="flex flex-col justify-start items-start w-full px-1 gap-2 h-auto shrink-0 flex-nowrap hide-scrollbar">
        {shouldShowRelationGraph && (
          <div className="relative w-full h-36 border border-border rounded-lg bg-muted">
            <MemoRelationForceGraph className="w-full h-full" memo={memo} parentPage={parentPage} />
            <div className="absolute top-1 left-2 text-xs opacity-60 font-mono gap-1 flex flex-row items-center">
              <span>{t("common.relations")}</span>
              <span className="text-xs opacity-60">(Beta)</span>
            </div>
          </div>
        )}
        <div className="w-full flex flex-col">
          <p className="flex flex-row justify-start items-center w-full gap-1 mb-1 text-sm leading-6 text-muted-foreground select-none">
            <span>{t("common.created-at")}</span>
          </p>
          <p className="text-sm text-muted-foreground">{memo.createTime?.toLocaleString()}</p>
        </div>
        {!isEqual(memo.createTime, memo.updateTime) && (
          <div className="w-full flex flex-col">
            <p className="flex flex-row justify-start items-center w-full gap-1 mb-1 text-sm leading-6 text-muted-foreground select-none">
              <span>{t("common.last-updated-at")}</span>
            </p>
            <p className="text-sm text-muted-foreground">{memo.updateTime?.toLocaleString()}</p>
          </div>
        )}
        {hasSpecialProperty && (
          <div className="w-full flex flex-col">
            <p className="flex flex-row justify-start items-center w-full gap-1 mb-1 text-sm leading-6 text-muted-foreground select-none">
              <span>{t("common.properties")}</span>
            </p>
            <div className="w-full flex flex-row justify-start items-center gap-x-2 gap-y-1 flex-wrap text-muted-foreground">
              {property.hasLink && (
                <div className="w-auto border border-border pl-1 pr-1.5 rounded-md flex justify-between items-center">
                  <div className="w-auto flex justify-start items-center mr-1">
                    <LinkIcon className="w-4 h-auto mr-1" />
                    <span className="block text-sm">{t("memo.links")}</span>
                  </div>
                </div>
              )}
              {property.hasTaskList && (
                <div className="w-auto border border-border pl-1 pr-1.5 rounded-md flex justify-between items-center">
                  <div className="w-auto flex justify-start items-center mr-1">
                    <CheckCircleIcon className="w-4 h-auto mr-1" />
                    <span className="block text-sm">{t("memo.to-do")}</span>
                  </div>
                </div>
              )}
              {property.hasCode && (
                <div className="w-auto border border-border pl-1 pr-1.5 rounded-md flex justify-between items-center">
                  <div className="w-auto flex justify-start items-center mr-1">
                    <Code2Icon className="w-4 h-auto mr-1" />
                    <span className="block text-sm">{t("memo.code")}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {memo.tags.length > 0 && (
          <div className="w-full">
            <div className="flex flex-row justify-start items-center w-full gap-1 mb-1 text-sm leading-6 text-muted-foreground select-none">
              <span>{t("common.tags")}</span>
              <span className="shrink-0">({memo.tags.length})</span>
            </div>
            <div className="w-full flex flex-row justify-start items-center relative flex-wrap gap-x-2 gap-y-1">
              {memo.tags.map((tag) => (
                <div
                  key={tag}
                  className="shrink-0 w-auto max-w-full text-sm rounded-md leading-6 flex flex-row justify-start items-center select-none hover:opacity-80 text-muted-foreground"
                >
                  <HashIcon className="group-hover:hidden w-4 h-auto shrink-0 opacity-40" />
                  <div className={cn("inline-flex flex-nowrap ml-0.5 gap-0.5 cursor-pointer max-w-[calc(100%-16px)]")}>
                    <span className="truncate opacity-80">{tag}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default MemoDetailSidebar;
