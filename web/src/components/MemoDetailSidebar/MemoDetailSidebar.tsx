import { create } from "@bufbuild/protobuf";
import { timestampDate } from "@bufbuild/protobuf/wkt";
import { isEqual } from "lodash-es";
import { CheckCircleIcon, Code2Icon, HashIcon, LinkIcon, Share2Icon } from "lucide-react";
import { useState } from "react";
import MemoSharePanel from "@/components/MemoSharePanel";
import { Button } from "@/components/ui/button";
import useCurrentUser from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";
import { Memo, Memo_PropertySchema, MemoRelation_Type } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { isSuperUser } from "@/utils/user";
import MemoRelationForceGraph from "../MemoRelationForceGraph";

interface Props {
  memo: Memo;
  className?: string;
  parentPage?: string;
}

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs font-medium text-muted-foreground/50 uppercase tracking-wider">{children}</p>
);

const MemoDetailSidebar = ({ memo, className, parentPage }: Props) => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const [sharePanelOpen, setSharePanelOpen] = useState(false);
  const property = create(Memo_PropertySchema, memo.property || {});
  const hasSpecialProperty = property.hasLink || property.hasTaskList || property.hasCode;
  const hasReferenceRelations = memo.relations.some((r) => r.type === MemoRelation_Type.REFERENCE);
  const canManageShares = !memo.parent && (memo.creator === currentUser?.name || isSuperUser(currentUser));

  return (
    <aside className={cn("relative w-full h-auto max-h-screen overflow-auto flex flex-col gap-5", className)}>
      {canManageShares && (
        <div className="w-full space-y-2">
          <SectionLabel>{t("memo.share.section-label")}</SectionLabel>
          <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setSharePanelOpen(true)}>
            <Share2Icon className="w-4 h-4" />
            {t("memo.share.open-panel")}
          </Button>
        </div>
      )}

      {hasReferenceRelations && (
        <div className="w-full space-y-2">
          <div className="flex items-center gap-1.5">
            <SectionLabel>{t("common.relations")}</SectionLabel>
            <span className="text-xs text-muted-foreground/30">(Beta)</span>
          </div>
          <div className="relative w-full h-36 border border-border rounded-lg bg-muted overflow-hidden">
            <MemoRelationForceGraph className="w-full h-full" memo={memo} parentPage={parentPage} />
          </div>
        </div>
      )}

      <div className="w-full space-y-1">
        <SectionLabel>{t("common.created-at")}</SectionLabel>
        <p className="text-sm text-foreground/70">{memo.createTime ? timestampDate(memo.createTime).toLocaleString() : "—"}</p>
      </div>

      {!isEqual(memo.createTime, memo.updateTime) && (
        <div className="w-full space-y-1">
          <SectionLabel>{t("common.last-updated-at")}</SectionLabel>
          <p className="text-sm text-foreground/70">{memo.updateTime ? timestampDate(memo.updateTime).toLocaleString() : "—"}</p>
        </div>
      )}

      {hasSpecialProperty && (
        <div className="w-full space-y-2">
          <SectionLabel>{t("common.properties")}</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {property.hasLink && (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-border/60 bg-muted/60 text-xs text-muted-foreground">
                <LinkIcon className="w-3.5 h-3.5" />
                {t("memo.links")}
              </span>
            )}
            {property.hasTaskList && (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-border/60 bg-muted/60 text-xs text-muted-foreground">
                <CheckCircleIcon className="w-3.5 h-3.5" />
                {t("memo.to-do")}
              </span>
            )}
            {property.hasCode && (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-border/60 bg-muted/60 text-xs text-muted-foreground">
                <Code2Icon className="w-3.5 h-3.5" />
                {t("memo.code")}
              </span>
            )}
          </div>
        </div>
      )}

      {memo.tags.length > 0 && (
        <div className="w-full space-y-2">
          <div className="flex items-center gap-1.5">
            <SectionLabel>{t("common.tags")}</SectionLabel>
            <span className="text-xs text-muted-foreground/30">({memo.tags.length})</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {memo.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-1 rounded-md border border-border/60 bg-muted/60 text-sm text-muted-foreground hover:bg-muted hover:text-foreground/80 transition-colors cursor-pointer"
              >
                <HashIcon className="w-3 h-3 opacity-50" />
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {sharePanelOpen && <MemoSharePanel memoName={memo.name} open={sharePanelOpen} onClose={() => setSharePanelOpen(false)} />}
    </aside>
  );
};

export default MemoDetailSidebar;
