import { ChevronRightIcon } from "lucide-react";
import { Link } from "react-router-dom";
import MetadataSection, { METADATA_COMPACT_ROW_CLASSES, METADATA_ROW_SLOT_CLASSES } from "@/components/MemoMetadata/MetadataSection";
import { MemoPreview } from "@/components/MemoPreview";
import { FOCUS_VISIBLE_OUTLINE_CLASSES } from "@/components/ui/focus";
import { useMemoComments } from "@/hooks/useMemoQueries";
import { useNearViewport } from "@/hooks/useNearViewport";
import { useUsersByNames } from "@/hooks/useUserQueries";
import { MEMO_COMMENTS_ANCHOR_ID } from "@/lib/memo-comments";
import { extractMemoIdFromName } from "@/lib/resource-names";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import UserAvatar from "../../UserAvatar";
import { useMemoViewContext, useMemoViewDerived } from "../MemoViewContext";
import { createMemoNavigationState } from "../navigation";

/**
 * "View all" speaks at the header's scale: 11px muted ink in a box as tall as the compact
 * header, so it sits on the title's line instead of stretching it.
 */
const VIEW_ALL_CLASSES = cn(
  "inline-flex h-5 items-center gap-0.5 rounded-md px-2 text-2xs text-muted-foreground/60 transition-colors hover:bg-muted/60 hover:text-foreground",
  FOCUS_VISIBLE_OUTLINE_CLASSES,
);

/**
 * The comment strip hangs off the card's bottom edge: a compact titled list of up to three
 * comments, each a 24px row whose avatar sits in the leading slot on the card's text edge.
 */
const MemoCommentListView: React.FC = () => {
  const t = useTranslate();
  const { memo, parentPage } = useMemoViewContext();
  const { isInMemoDetailPage, commentAmount } = useMemoViewDerived();
  const { ref: viewportRef, isNearViewport } = useNearViewport<HTMLDivElement>();

  const { data } = useMemoComments(memo.name, {
    enabled: isNearViewport && !isInMemoDetailPage && commentAmount > 0,
    pageSize: 3,
  });
  const comments = data?.comments ?? [];
  const displayedComments = comments.slice(0, 3);
  const { data: commentCreators } = useUsersByNames(displayedComments.map((comment) => comment.creator));

  if (isInMemoDetailPage || commentAmount === 0) {
    return null;
  }

  return (
    <div ref={viewportRef} className="rounded-b-lg border border-t-0 border-border/70 px-4 py-1">
      <MetadataSection
        title={t("memo.comment.self")}
        count={commentAmount}
        density="compact"
        action={
          <Link to={`/${memo.name}#${MEMO_COMMENTS_ANCHOR_ID}`} state={createMemoNavigationState(parentPage)} className={VIEW_ALL_CLASSES}>
            {t("common.view-all")}
            <ChevronRightIcon className="-me-0.5 size-3" strokeWidth={2} />
          </Link>
        }
      >
        {displayedComments.map((comment) => {
          const uid = extractMemoIdFromName(comment.name);
          const creator = commentCreators?.get(comment.creator);
          return (
            <Link
              key={comment.name}
              to={`/${memo.name}#${uid}`}
              state={createMemoNavigationState(parentPage)}
              viewTransition
              className={METADATA_COMPACT_ROW_CLASSES}
            >
              <span className={METADATA_ROW_SLOT_CLASSES} aria-hidden="true">
                <UserAvatar className="size-4" avatarUrl={creator?.avatarUrl} name={creator?.displayName || creator?.username} />
              </span>
              <MemoPreview
                className="min-w-0 flex-1"
                content={comment.snippet || comment.content}
                attachments={comment.attachments}
                creator={creator}
                showCreator
                truncate
              />
            </Link>
          );
        })}
      </MetadataSection>
    </div>
  );
};

export default MemoCommentListView;
