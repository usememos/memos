import { create } from "@bufbuild/protobuf";
import { timestampDate } from "@bufbuild/protobuf/wkt";
import { isEqual } from "lodash-es";
import { CheckCircleIcon, Code2Icon, HashIcon, LinkIcon, SparklesIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Memo, Memo_PropertySchema, MemoRelation_Type } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import AIInsightDialog from "../AIInsightDialog";
import MemoRelationForceGraph from "../MemoRelationForceGraph";

interface Props {
  memo: Memo;
  className?: string;
  parentPage?: string;
}

const MemoDetailSidebar = ({ memo, className, parentPage }: Props) => {
  const t = useTranslate();
  const [insightDialogOpen, setInsightDialogOpen] = useState(false);
  const property = create(Memo_PropertySchema, memo.property || {});
  const hasSpecialProperty = property.hasLink || property.hasTaskList || property.hasCode;
  const hasReferenceRelations = memo.relations.some((r) => r.type === MemoRelation_Type.REFERENCE);

  const insightMemoNames = useMemo(() => {
    const names = [memo.name];
    for (const relation of memo.relations) {
      if (relation.type === MemoRelation_Type.REFERENCE && relation.relatedMemo?.name) {
        names.push(relation.relatedMemo.name);
      }
    }
    return names;
  }, [memo.name, memo.relations]);

  return (
    <aside className={cn("relative w-full h-auto max-h-screen overflow-auto flex flex-col justify-start items-start", className)}>
      <div className="flex flex-col justify-start items-start w-full gap-4 h-auto shrink-0 flex-nowrap">
        {hasReferenceRelations && (
          <div className="relative w-full h-36 border border-border rounded-lg bg-muted overflow-hidden">
            <MemoRelationForceGraph className="w-full h-full" memo={memo} parentPage={parentPage} />
            <div className="absolute top-2 left-2 text-xs text-muted-foreground/60 font-medium gap-1 flex flex-row items-center">
              <span>{t("common.relations")}</span>
              <span className="text-xs opacity-60">(Beta)</span>
            </div>
          </div>
        )}

        <div className="w-full space-y-1">
          <p className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wide px-1">{t("common.created-at")}</p>
          <p className="text-sm text-muted-foreground px-1">{memo.createTime ? timestampDate(memo.createTime).toLocaleString() : "-"}</p>
        </div>

        {!isEqual(memo.createTime, memo.updateTime) && (
          <div className="w-full space-y-1">
            <p className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wide px-1">{t("common.last-updated-at")}</p>
            <p className="text-sm text-muted-foreground px-1">{memo.updateTime ? timestampDate(memo.updateTime).toLocaleString() : "-"}</p>
          </div>
        )}

        {hasSpecialProperty && (
          <div className="w-full space-y-2">
            <p className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wide px-1">{t("common.properties")}</p>
            <div className="w-full flex flex-row justify-start items-center gap-2 flex-wrap px-1">
              {property.hasLink && (
                <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-muted/50 border border-border/50 rounded-md text-xs text-muted-foreground">
                  <LinkIcon className="w-3.5 h-3.5" />
                  <span>{t("memo.links")}</span>
                </div>
              )}
              {property.hasTaskList && (
                <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-muted/50 border border-border/50 rounded-md text-xs text-muted-foreground">
                  <CheckCircleIcon className="w-3.5 h-3.5" />
                  <span>{t("memo.to-do")}</span>
                </div>
              )}
              {property.hasCode && (
                <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-muted/50 border border-border/50 rounded-md text-xs text-muted-foreground">
                  <Code2Icon className="w-3.5 h-3.5" />
                  <span>{t("memo.code")}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {memo.tags.length > 0 && (
          <div className="w-full space-y-2">
            <div className="flex flex-row justify-start items-center gap-1.5 px-1">
              <p className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wide">{t("common.tags")}</p>
              <span className="text-xs text-muted-foreground/40">({memo.tags.length})</span>
            </div>
            <div className="w-full flex flex-row justify-start items-center flex-wrap gap-1.5 px-1">
              {memo.tags.map((tag) => (
                <div
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted/50 border border-border/50 rounded-md text-xs text-muted-foreground hover:bg-muted transition-colors cursor-pointer group"
                >
                  <HashIcon className="w-3 h-3 opacity-40 group-hover:opacity-60 transition-opacity" />
                  <span className="opacity-80 group-hover:opacity-100 transition-opacity">{tag}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="w-full pt-2">
          <Button variant="outline" className="w-full gap-2" onClick={() => setInsightDialogOpen(true)}>
            <SparklesIcon className="w-4 h-4 text-amber-500" />
            AI Insight
          </Button>
        </div>
      </div>

      <AIInsightDialog open={insightDialogOpen} onOpenChange={setInsightDialogOpen} memoNames={insightMemoNames} />
    </aside>
  );
};

export default MemoDetailSidebar;
