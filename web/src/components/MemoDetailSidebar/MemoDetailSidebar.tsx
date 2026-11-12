import { Menu } from "@usememos/ui";
import copy from "copy-to-clipboard";
import {
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
import { Link, useLocation } from "react-router-dom";
import SidebarRow, {
  SIDEBAR_ROW_CLASSES,
  SIDEBAR_ROW_COUNT_RAIL_CLASSES,
  SidebarRowIconSlot,
  sidebarRowStateClasses,
} from "@/components/AppSidebar/SidebarRow";
import SidebarSection, { SIDEBAR_SECTION_STACK_CLASSES } from "@/components/AppSidebar/SidebarSection";
import { extractHeadings } from "@/components/MemoEditor/view/headings";
import { getRelationBuckets, getRelationMemo } from "@/components/MemoMetadata/Relation/relationHelpers";
import { useResolvedRelationMemos } from "@/components/MemoMetadata/Relation/useResolvedRelationMemos";
import MemoParentPlaceholder, { type MemoParentStatus } from "@/components/MemoParentPlaceholder";
import { createMemoNavigationState } from "@/components/MemoView/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useInstance } from "@/contexts/InstanceContext";
import { useOverflowTitle } from "@/hooks";
import useCurrentUser from "@/hooks/useCurrentUser";
import { MEMO_COMMENTS_ANCHOR_ID } from "@/lib/memo-comments";
import { isMemoBlurred } from "@/lib/tag";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { State } from "@/types/proto/api/common_pb";
import { Memo, type MemoRelation, Visibility } from "@/types/proto/api/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { canManageMemo } from "@/utils/user";
import MemoOutline from "./MemoOutline";
import MemoSharePanel from "./MemoSharePanel";

interface Props {
  memo: Memo;
  parentMemo?: Memo;
  parentStatus?: MemoParentStatus;
  onParentRetry?: () => void;
  parentPage?: string;
  commentCount?: number;
  className?: string;
  onEdit?: () => void;
  onCommentsOpen?: () => void;
  onCommentCreate?: () => void;
  onShareImageOpen?: () => void;
  forceReadonly?: boolean;
  /** The memo body is tag-blurred and not yet revealed; its outline would leak the headings. */
  contentHidden?: boolean;
}

const normalizeSnippet = (value: string): string => value.replace(/\s+/g, " ").trim();

const BacklinkRow = ({
  relation,
  snippet,
  parentPage,
  referencedByLabel,
}: {
  relation: MemoRelation;
  snippet: string;
  parentPage?: string;
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
      className={cn(SIDEBAR_ROW_CLASSES, sidebarRowStateClasses("idle"))}
      to={`/${relatedMemo.name}`}
      state={parentPage ? createMemoNavigationState(parentPage) : undefined}
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
  parentStatus,
  onParentRetry,
  parentPage,
  commentCount,
  className,
  onEdit,
  onCommentsOpen,
  onCommentCreate,
  onShareImageOpen,
  forceReadonly = false,
  contentHidden = false,
}: Props) => {
  const t = useTranslate();
  const location = useLocation();
  const currentUser = useCurrentUser();
  const { profile } = useInstance();
  const { userTagsSetting } = useAuth();
  const [sharePanelOpen, setSharePanelOpen] = useState(false);

  const readonly = forceReadonly || !canManageMemo(memo, currentUser);
  const canEdit = !!onEdit && !readonly && memo.state === State.NORMAL;
  const canComment = !!onCommentCreate && !forceReadonly && !!currentUser && memo.state === State.NORMAL;
  const canManageShares =
    !forceReadonly &&
    !memo.parent &&
    canManageMemo(memo, currentUser) &&
    memo.state === State.NORMAL &&
    memo.visibility !== Visibility.SPACE;

  const headings = useMemo(() => (contentHidden ? [] : extractHeadings(memo.content)), [contentHidden, memo.content]);
  const { referenced } = useMemo(() => getRelationBuckets(memo.relations, memo.name), [memo.relations, memo.name]);
  const backlinkMemoNames = useMemo(
    () =>
      forceReadonly
        ? []
        : referenced.flatMap((relation) => {
            const relatedMemo = getRelationMemo(relation, "referenced");
            return relatedMemo?.name ? [relatedMemo.name] : [];
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

  const parentBlurred = !!parentMemo && isMemoBlurred(parentMemo, userTagsSetting);
  const parentSnippet = parentMemo && !parentBlurred ? normalizeSnippet(parentMemo.snippet || parentMemo.content || parentMemo.name) : "";
  const showComments = !forceReadonly && commentCount !== undefined && commentCount > 0;
  const showOnThisMemo = headings.length > 1 || showComments;
  const showConnections = !forceReadonly && (!!parentMemo || !!parentStatus || referenced.length > 0);

  const handleCopyLink = () => {
    const host = (profile.instanceUrl || window.location.origin).replace(/\/+$/, "");
    const path = forceReadonly ? `${location.pathname}${location.search}` : `/${memo.name}`;
    copy(`${host}${path.startsWith("/") ? path : `/${path}`}`);
    toast.add({ title: t("message.succeed-copy-link"), type: "success" });
  };

  return (
    <div className={cn("mu-compact relative w-full select-none", SIDEBAR_SECTION_STACK_CLASSES, className)}>
      {showOnThisMemo && (
        <SidebarSection label={t("memo.on-this-memo")}>
          {headings.length > 1 && <MemoOutline headings={headings} memoName={memo.name} />}
          {showComments && (
            <a
              className={cn(SIDEBAR_ROW_CLASSES, sidebarRowStateClasses("idle"))}
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
          {parentStatus && <MemoParentPlaceholder status={parentStatus} onRetry={onParentRetry} />}
          {!parentStatus && parentMemo && (
            <Link
              aria-label={parentSnippet ? `${t("memo.parent-memo")}: ${parentSnippet}` : t("memo.parent-memo")}
              className={cn(SIDEBAR_ROW_CLASSES, sidebarRowStateClasses("idle"))}
              to={`/${parentMemo.name}`}
              state={parentPage ? createMemoNavigationState(parentPage) : undefined}
              title={parentSnippet || undefined}
              viewTransition
            >
              <SidebarRowIconSlot icon={CornerUpLeftIcon} />
              <span className="min-w-0 flex-1 truncate text-start">{parentSnippet || t("memo.parent-memo")}</span>
            </Link>
          )}
          {referenced.map((relation) => {
            const relatedMemo = getRelationMemo(relation, "referenced");
            if (relatedMemo && resolvedMemos[relatedMemo.name] === null) return null;
            return (
              <BacklinkRow
                key={`referenced-${relatedMemo?.name}`}
                relation={relation}
                snippet={backlinkSnippet(relation)}
                parentPage={parentPage}
                referencedByLabel={t("common.referenced-by")}
              />
            );
          })}
        </SidebarSection>
      )}

      <SidebarSection label={t("common.actions")}>
        {canEdit && <SidebarRow icon={Edit3Icon} label={t("common.edit")} onClick={onEdit} />}
        {canComment && <SidebarRow icon={MessageSquarePlusIcon} label={t("memo.comment.write-a-comment")} onClick={onCommentCreate} />}
        <Menu.Root modal={false}>
          <Menu.Trigger
            aria-label={t("common.share")}
            className={cn(
              SIDEBAR_ROW_CLASSES,
              sidebarRowStateClasses("idle"),
              "data-popup-open:bg-mu-hover/65 data-popup-open:text-mu-ink",
            )}
          >
            <SidebarRowIconSlot icon={Share2Icon} />
            <span className="min-w-0 flex-1 truncate text-start">{t("common.share")}</span>
            <ChevronDownIcon className="mu-icon-sm shrink-0 opacity-55" />
          </Menu.Trigger>
          <Menu.Popup align="start">
            <Menu.Item onClick={handleCopyLink} icon={<LinkIcon />}>
              {t("memo.copy-link")}
            </Menu.Item>
            {onShareImageOpen && (
              <Menu.Item onClick={onShareImageOpen} icon={<ImageIcon />}>
                {t("memo.share.open-image")}
              </Menu.Item>
            )}
            {canManageShares && (
              <Menu.Item onClick={() => setSharePanelOpen(true)} icon={<Share2Icon />}>
                {t("memo.share.open-panel")}
              </Menu.Item>
            )}
          </Menu.Popup>
        </Menu.Root>
      </SidebarSection>

      {sharePanelOpen && <MemoSharePanel memoName={memo.name} open={sharePanelOpen} onClose={() => setSharePanelOpen(false)} />}
    </div>
  );
};

export default MemoDetailSidebar;
