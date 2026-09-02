import copy from "copy-to-clipboard";
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  CornerUpLeftIcon,
  Edit3Icon,
  ImageIcon,
  LinkIcon,
  MessageCircleIcon,
  MessageSquarePlusIcon,
  Share2Icon,
} from "lucide-react";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Link, useLocation } from "react-router-dom";
import { getSidebarRouteKind } from "@/components/AppSidebar/routes";
import SidebarRow, { SIDEBAR_ROW_CLASSES, SIDEBAR_ROW_COUNT_RAIL_CLASSES, SidebarRowIconSlot } from "@/components/AppSidebar/SidebarRow";
import SidebarSection, { SIDEBAR_SECTION_STACK_CLASSES } from "@/components/AppSidebar/SidebarSection";
import { extractHeadings } from "@/components/MemoContent/pipeline";
import { getRelationBuckets, getRelationMemo } from "@/components/MemoMetadata/Relation/relationHelpers";
import { useResolvedRelationMemos } from "@/components/MemoMetadata/Relation/useResolvedRelationMemos";
import { createMemoNavigationState, isMemoCollectionOrigin, type MemoOriginScope } from "@/components/MemoView/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useInstance } from "@/contexts/InstanceContext";
import { useSpaceContext } from "@/contexts/SpaceContext";
import { useOverflowTitle } from "@/hooks";
import useCurrentUser from "@/hooks/useCurrentUser";
import { MEMO_COMMENTS_ANCHOR_ID } from "@/lib/memo-comments";
import { cn } from "@/lib/utils";
import { State } from "@/types/proto/api/v1/common_pb";
import { Memo, type MemoRelation, Visibility } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { isSuperUser } from "@/utils/user";
import MemoOutline from "./MemoOutline";
import MemoSharePanel from "./MemoSharePanel";

interface Props {
  memo: Memo;
  parentMemo?: Memo;
  parentPage?: string;
  parentScope?: MemoOriginScope;
  hasExplicitOrigin?: boolean;
  commentCount?: number;
  className?: string;
  onEdit?: () => void;
  onCommentsOpen?: () => void;
  onCommentCreate?: () => void;
  onShareImageOpen?: () => void;
  forceReadonly?: boolean;
}

const normalizeSnippet = (value: string): string => value.replace(/\s+/g, " ").trim();

const BacklinkRow = ({
  relation,
  snippet,
  parentPage,
  parentScope,
  referencedByLabel,
}: {
  relation: MemoRelation;
  snippet: string;
  parentPage?: string;
  parentScope?: MemoOriginScope;
  referencedByLabel: string;
}) => {
  const { ref, title } = useOverflowTitle<HTMLSpanElement>(snippet);
  const relatedMemo = getRelationMemo(relation, "referenced");
  if (!relatedMemo) {
    return null;
  }

  return (
    <Link
      aria-label={`${referencedByLabel}: ${snippet}`}
      className={cn(SIDEBAR_ROW_CLASSES, "text-muted-foreground hover:bg-sidebar-accent/65 hover:text-foreground")}
      to={`/${relatedMemo.name}`}
      state={parentPage && parentScope ? createMemoNavigationState(parentPage, parentScope) : undefined}
      title={title}
      viewTransition
    >
      <SidebarRowIconSlot icon={LinkIcon} />
      <span ref={ref} className="min-w-0 flex-1 truncate text-start">
        {snippet}
      </span>
    </Link>
  );
};

const MemoDetailSidebar = ({
  memo,
  parentMemo,
  parentPage,
  parentScope,
  hasExplicitOrigin = false,
  commentCount,
  className,
  onEdit,
  onCommentsOpen,
  onCommentCreate,
  onShareImageOpen,
  forceReadonly = false,
}: Props) => {
  const t = useTranslate();
  const location = useLocation();
  const currentUser = useCurrentUser();
  const { profile } = useInstance();
  const { clearSelectedSpace } = useSpaceContext();
  const [sharePanelOpen, setSharePanelOpen] = useState(false);

  const readonly = forceReadonly || (memo.creator !== currentUser?.name && !isSuperUser(currentUser));
  const canEdit = !!onEdit && !readonly && memo.state === State.NORMAL;
  const canComment = !!onCommentCreate && !forceReadonly && !!currentUser && memo.state === State.NORMAL;
  const canManageShares =
    !forceReadonly &&
    !memo.parent &&
    memo.creator === currentUser?.name &&
    memo.state === State.NORMAL &&
    memo.visibility !== Visibility.SPACE;

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
    return normalizeSnippet(relatedMemo.snippet || resolvedMemos[relatedMemo.name]?.snippet || relatedMemo.name);
  };

  const originLabel = useMemo(() => {
    const originPath = parentPage?.split(/[?#]/, 1)[0] || "/";
    switch (getSidebarRouteKind(originPath)) {
      case "explore":
        return t("common.explore");
      case "archived":
        return t("common.archived");
      case "attachments":
        return t("common.attachments");
      case "profile":
        return t("common.profile");
      case "views":
        return t("common.views");
      case "inbox":
        return t("common.inbox");
      case "settings":
        return t("common.settings");
      default:
        return t("common.home");
    }
  }, [parentPage, t]);

  const parentSnippet = parentMemo ? normalizeSnippet(parentMemo.snippet || parentMemo.content || parentMemo.name) : "";
  const showComments = !forceReadonly && commentCount !== undefined && commentCount > 0;
  const showOnThisMemo = headings.length > 1 || showComments;
  const showConnections = !forceReadonly && (!!parentMemo || referenced.length > 0);

  const handleCopyLink = () => {
    const host = (profile.instanceUrl || window.location.origin).replace(/\/+$/, "");
    const path = forceReadonly ? `${location.pathname}${location.search}` : `/${memo.name}`;
    copy(`${host}${path.startsWith("/") ? path : `/${path}`}`);
    toast.success(t("message.succeed-copy-link"));
  };

  return (
    <div className={cn("relative w-full select-none", SIDEBAR_SECTION_STACK_CLASSES, className)}>
      {!forceReadonly && parentPage && (
        <SidebarSection
          ariaLabel={hasExplicitOrigin ? t("memo.back-to", { source: originLabel }) : t("memo.go-to", { source: originLabel })}
        >
          <Link
            className={cn(SIDEBAR_ROW_CLASSES, "text-muted-foreground hover:bg-sidebar-accent/65 hover:text-foreground")}
            to={parentPage}
            onClick={() => {
              if (parentScope === "all" && isMemoCollectionOrigin(parentPage)) {
                clearSelectedSpace();
              }
            }}
            viewTransition
          >
            <SidebarRowIconSlot icon={ArrowLeftIcon} />
            <span className="min-w-0 flex-1 truncate text-start">
              {hasExplicitOrigin ? t("memo.back-to", { source: originLabel }) : t("memo.go-to", { source: originLabel })}
            </span>
          </Link>
        </SidebarSection>
      )}

      {showOnThisMemo && (
        <SidebarSection label={t("memo.on-this-memo")}>
          {headings.length > 1 && <MemoOutline headings={headings} memoName={memo.name} />}
          {showComments && (
            <a
              className={cn(SIDEBAR_ROW_CLASSES, "text-muted-foreground hover:bg-sidebar-accent/65 hover:text-foreground")}
              href={`#${MEMO_COMMENTS_ANCHOR_ID}`}
              onClick={(event) => {
                if (!onCommentsOpen) return;
                event.preventDefault();
                onCommentsOpen();
              }}
            >
              <SidebarRowIconSlot icon={MessageCircleIcon} />
              <span className="min-w-0 flex-1 truncate text-start">{t("memo.comment.self")}</span>
              <span className={SIDEBAR_ROW_COUNT_RAIL_CLASSES}>{commentCount}</span>
            </a>
          )}
        </SidebarSection>
      )}

      {showConnections && (
        <SidebarSection label={t("memo.connections")}>
          {parentMemo && (
            <Link
              aria-label={`${t("memo.parent-memo")}: ${parentSnippet}`}
              className={cn(SIDEBAR_ROW_CLASSES, "text-muted-foreground hover:bg-sidebar-accent/65 hover:text-foreground")}
              to={`/${parentMemo.name}`}
              state={parentPage && parentScope ? createMemoNavigationState(parentPage, parentScope) : undefined}
              title={parentSnippet}
              viewTransition
            >
              <SidebarRowIconSlot icon={CornerUpLeftIcon} />
              <span className="min-w-0 flex-1 truncate text-start">{parentSnippet}</span>
            </Link>
          )}
          {referenced.map((relation) => {
            const relatedMemo = getRelationMemo(relation, "referenced");
            return (
              <BacklinkRow
                key={`referenced-${relatedMemo?.name}`}
                relation={relation}
                snippet={backlinkSnippet(relation)}
                parentPage={parentPage}
                parentScope={parentScope}
                referencedByLabel={t("common.referenced-by")}
              />
            );
          })}
        </SidebarSection>
      )}

      <SidebarSection label={t("common.actions")}>
        {canEdit && <SidebarRow icon={Edit3Icon} label={t("common.edit")} onClick={onEdit} />}
        {canComment && <SidebarRow icon={MessageSquarePlusIcon} label={t("memo.comment.write-a-comment")} onClick={onCommentCreate} />}
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={t("common.share")}
            className={cn(
              SIDEBAR_ROW_CLASSES,
              "text-muted-foreground hover:bg-sidebar-accent/65 hover:text-foreground data-popup-open:bg-sidebar-accent/65 data-popup-open:text-foreground",
            )}
          >
            <SidebarRowIconSlot icon={Share2Icon} />
            <span className="min-w-0 flex-1 truncate text-start">{t("common.share")}</span>
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

      {sharePanelOpen && <MemoSharePanel memoName={memo.name} open={sharePanelOpen} onClose={() => setSharePanelOpen(false)} />}
    </div>
  );
};

export default MemoDetailSidebar;
