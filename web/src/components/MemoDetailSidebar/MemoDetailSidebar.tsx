import copy from "copy-to-clipboard";
import { BookmarkCheckIcon, BookmarkIcon, ChevronDownIcon, ImageIcon, LinkIcon, Share2Icon } from "lucide-react";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import SidebarRow, { SIDEBAR_ROW_CLASSES, SIDEBAR_ROW_ICON_CLASSES } from "@/components/AppSidebar/SidebarRow";
import SidebarSection, { SIDEBAR_SECTION_STACK_CLASSES } from "@/components/AppSidebar/SidebarSection";
import { extractHeadings } from "@/components/MemoContent/pipeline";
import { getRelationBuckets, getRelationMemo } from "@/components/MemoMetadata/Relation/relationHelpers";
import { useResolvedRelationMemos } from "@/components/MemoMetadata/Relation/useResolvedRelationMemos";
import { createMemoNavigationState, type MemoOriginScope } from "@/components/MemoView/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useInstance } from "@/contexts/InstanceContext";
import { useOverflowTitle } from "@/hooks";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useUpdateMemo } from "@/hooks/useMemoQueries";
import { cn } from "@/lib/utils";
import { State } from "@/types/proto/api/v1/common_pb";
import { Memo, type MemoRelation } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { isSuperUser } from "@/utils/user";
import MemoOutline from "./MemoOutline";
import MemoSharePanel from "./MemoSharePanel";

interface Props {
  memo: Memo;
  parentPage?: string;
  parentScope?: MemoOriginScope;
  className?: string;
  onShareImageOpen?: () => void;
  forceReadonly?: boolean;
}

const BacklinkRow = ({
  relation,
  snippet,
  parentPage,
  parentScope,
}: {
  relation: MemoRelation;
  snippet: string;
  parentPage?: string;
  parentScope?: MemoOriginScope;
}) => {
  const { ref, title } = useOverflowTitle<HTMLSpanElement>(snippet);
  const relatedMemo = getRelationMemo(relation, "referenced");
  if (!relatedMemo) {
    return null;
  }

  return (
    <Link
      className={cn(SIDEBAR_ROW_CLASSES, "text-muted-foreground hover:bg-sidebar-accent/65 hover:text-foreground")}
      to={`/${relatedMemo.name}`}
      state={parentPage && parentScope ? createMemoNavigationState(parentPage, parentScope) : undefined}
      title={title}
      viewTransition
    >
      <LinkIcon className={SIDEBAR_ROW_ICON_CLASSES} strokeWidth={1.8} />
      <span ref={ref} className="min-w-0 flex-1 truncate text-left">
        {snippet}
      </span>
    </Link>
  );
};

const MemoDetailSidebar = ({ memo, parentPage, parentScope, className, onShareImageOpen, forceReadonly = false }: Props) => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const { profile } = useInstance();
  const { mutateAsync: updateMemo } = useUpdateMemo();
  const [sharePanelOpen, setSharePanelOpen] = useState(false);

  const readonly = forceReadonly || (memo.creator !== currentUser?.name && !isSuperUser(currentUser));
  const canPin = !readonly && !memo.parent && memo.state === State.NORMAL;
  const canManageShares = !forceReadonly && !memo.parent && (memo.creator === currentUser?.name || isSuperUser(currentUser));

  const headings = useMemo(() => extractHeadings(memo.content), [memo.content]);
  const { referenced } = useMemo(() => getRelationBuckets(memo.relations, memo.name), [memo.relations, memo.name]);
  const backlinkMemoNames = useMemo(
    () =>
      forceReadonly
        ? []
        : referenced.flatMap((relation) => {
            const relatedMemo = getRelationMemo(relation, "referenced");
            return relatedMemo?.name && !relatedMemo.snippet ? [relatedMemo.name] : [];
          }),
    [forceReadonly, referenced],
  );
  const resolvedMemos = useResolvedRelationMemos(backlinkMemoNames);

  const backlinkSnippet = (relation: MemoRelation) => {
    const relatedMemo = getRelationMemo(relation, "referenced");
    if (!relatedMemo) {
      return "";
    }
    return relatedMemo.snippet || resolvedMemos[relatedMemo.name]?.snippet || relatedMemo.name;
  };

  const handleTogglePin = async () => {
    await updateMemo({ update: { name: memo.name, pinned: !memo.pinned }, updateMask: ["pinned"] });
  };

  const handleCopyLink = () => {
    const host = profile.instanceUrl || window.location.origin;
    copy(`${host}/${memo.name}`);
    toast.success(t("message.succeed-copy-link"));
  };

  return (
    <div className={cn("relative w-full select-none", SIDEBAR_SECTION_STACK_CLASSES, className)}>
      <SidebarSection label={t("common.actions")}>
        {canPin && (
          <SidebarRow
            icon={memo.pinned ? BookmarkCheckIcon : BookmarkIcon}
            label={memo.pinned ? t("common.unpin") : t("common.pin")}
            onClick={handleTogglePin}
          />
        )}
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={t("common.share")}
            className={cn(
              SIDEBAR_ROW_CLASSES,
              "text-muted-foreground hover:bg-sidebar-accent/65 hover:text-foreground data-popup-open:bg-sidebar-accent/65 data-popup-open:text-foreground",
            )}
          >
            <Share2Icon className={SIDEBAR_ROW_ICON_CLASSES} strokeWidth={1.8} />
            <span className="min-w-0 flex-1 truncate text-left">{t("common.share")}</span>
            <ChevronDownIcon className="size-3.5 shrink-0 opacity-55" strokeWidth={1.8} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={4} className="w-48">
            <DropdownMenuItem onClick={handleCopyLink}>
              <LinkIcon />
              {t("memo.copy-link")}
            </DropdownMenuItem>
            {onShareImageOpen && (
              <DropdownMenuItem onClick={onShareImageOpen}>
                <ImageIcon />
                {t("memo.share.open-image")}
              </DropdownMenuItem>
            )}
            {canManageShares && (
              <DropdownMenuItem onClick={() => setSharePanelOpen(true)}>
                <Share2Icon />
                {t("memo.share.open-panel")}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarSection>

      {headings.length > 1 && (
        <SidebarSection label={t("memo.outline")}>
          <MemoOutline headings={headings} memoName={memo.name} />
        </SidebarSection>
      )}

      {!forceReadonly && referenced.length > 0 && (
        <SidebarSection label={t("common.referenced-by")}>
          {referenced.map((relation) => {
            const relatedMemo = getRelationMemo(relation, "referenced");
            return (
              <BacklinkRow
                key={`referenced-${relatedMemo?.name}`}
                relation={relation}
                snippet={backlinkSnippet(relation)}
                parentPage={parentPage}
                parentScope={parentScope}
              />
            );
          })}
        </SidebarSection>
      )}

      {sharePanelOpen && <MemoSharePanel memoName={memo.name} open={sharePanelOpen} onClose={() => setSharePanelOpen(false)} />}
    </div>
  );
};

export default MemoDetailSidebar;
