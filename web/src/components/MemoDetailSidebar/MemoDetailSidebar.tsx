import { create } from "@bufbuild/protobuf";
import { timestampDate } from "@bufbuild/protobuf/wkt";
import { isEqual } from "lodash-es";
import { CheckCircleIcon, Code2Icon, HashIcon, LinkIcon, type LucideIcon, Share2Icon } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import useCurrentUser from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";
import { Memo, Memo_PropertySchema } from "@/types/proto/api/v1/memo_service_pb";
import { type Translations, useTranslate } from "@/utils/i18n";
import { extractHeadings } from "@/utils/markdown-manipulation";
import { isSuperUser } from "@/utils/user";
import MemoOutline from "./MemoOutline";
import MemoSharePanel from "./MemoSharePanel";

interface Props {
  memo: Memo;
  className?: string;
}

interface PropertyBadge {
  icon: LucideIcon;
  labelKey: Translations;
}

const SidebarSection = ({ label, count, children }: { label: string; count?: number; children: React.ReactNode }) => (
  <div className="w-full space-y-2">
    <div className="flex items-center gap-1.5">
      <p className="text-xs font-medium text-muted-foreground/50 uppercase tracking-wider">{label}</p>
      {count != null && <span className="text-xs text-muted-foreground/30">({count})</span>}
    </div>
    {children}
  </div>
);

const PROPERTY_BADGE_CLASSES =
  "inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-border/60 bg-muted/60 text-xs text-muted-foreground";

const TAG_BADGE_CLASSES =
  "inline-flex items-center gap-1 px-1 rounded-md border border-border/60 bg-muted/60 text-sm text-muted-foreground hover:bg-muted hover:text-foreground/80 transition-colors cursor-pointer";

const MemoDetailSidebar = ({ memo, className }: Props) => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const [sharePanelOpen, setSharePanelOpen] = useState(false);
  const property = create(Memo_PropertySchema, memo.property || {});
  const canManageShares = !memo.parent && (memo.creator === currentUser?.name || isSuperUser(currentUser));
  const hasUpdated = !isEqual(memo.createTime, memo.updateTime);
  const headings = useMemo(() => extractHeadings(memo.content), [memo.content]);

  const propertyBadges = useMemo(() => {
    const badges: PropertyBadge[] = [];
    if (property.hasLink) badges.push({ icon: LinkIcon, labelKey: "memo.links" });
    if (property.hasTaskList) badges.push({ icon: CheckCircleIcon, labelKey: "memo.to-do" });
    if (property.hasCode) badges.push({ icon: Code2Icon, labelKey: "memo.code" });
    return badges;
  }, [property.hasLink, property.hasTaskList, property.hasCode]);

  return (
    <aside className={cn("relative w-full h-auto max-h-screen overflow-auto flex flex-col gap-5", className)}>
      {headings.length > 0 && (
        <SidebarSection label={t("memo.outline")}>
          <MemoOutline headings={headings} />
        </SidebarSection>
      )}

      {canManageShares && (
        <SidebarSection label={t("memo.share.section-label")}>
          <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setSharePanelOpen(true)}>
            <Share2Icon className="w-4 h-4" />
            {t("memo.share.open-panel")}
          </Button>
        </SidebarSection>
      )}

      <SidebarSection label={t("common.created-at")}>
        <div className="flex flex-col gap-1">
          <p className="text-sm text-foreground/70">{memo.createTime ? timestampDate(memo.createTime).toLocaleString() : "—"}</p>
          {hasUpdated && (
            <p className="text-xs text-muted-foreground">
              {t("common.last-updated-at")}: {memo.updateTime ? timestampDate(memo.updateTime).toLocaleString() : "—"}
            </p>
          )}
        </div>
      </SidebarSection>

      {propertyBadges.length > 0 && (
        <SidebarSection label={t("common.properties")}>
          <div className="flex flex-wrap gap-1.5">
            {propertyBadges.map(({ icon: Icon, labelKey }) => (
              <span key={labelKey} className={PROPERTY_BADGE_CLASSES}>
                <Icon className="w-3.5 h-3.5" />
                {t(labelKey)}
              </span>
            ))}
          </div>
        </SidebarSection>
      )}

      {memo.tags.length > 0 && (
        <SidebarSection label={t("common.tags")} count={memo.tags.length}>
          <div className="flex flex-wrap gap-1.5">
            {memo.tags.map((tag) => (
              <span key={tag} className={TAG_BADGE_CLASSES}>
                <HashIcon className="w-3 h-3 opacity-50" />
                {tag}
              </span>
            ))}
          </div>
        </SidebarSection>
      )}

      {sharePanelOpen && <MemoSharePanel memoName={memo.name} open={sharePanelOpen} onClose={() => setSharePanelOpen(false)} />}
    </aside>
  );
};

export default MemoDetailSidebar;
