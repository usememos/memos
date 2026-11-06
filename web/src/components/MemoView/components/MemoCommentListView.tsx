import { Link } from "react-router-dom";
import {
  METADATA_COMPACT_ROW_CLASSES,
  METADATA_ROW_LIST_CLASSES,
  METADATA_ROW_SLOT_CLASSES,
} from "@/components/MemoMetadata/MetadataSection";
import { MemoPreview } from "@/components/MemoPreview";
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

/** The strip previews this many comments; the rest are behind its trailing link. */
const COMMENT_PREVIEW_LIMIT = 3;
/** Rows are 24px with no gap, so the strip holds its height while the comments load. */
const PREVIEW_MIN_HEIGHT_CLASSES = ["", "min-h-6", "min-h-12", "min-h-18"];

/**
 * The comment strip hangs off the card's bottom edge: up to three comments, each a 24px row
 * whose avatar sits in the leading slot on the card's text edge, then a "View all N comments"
 * row when there are more. No title: sitting outside the card already marks the strip as
 * secondary, and every line is muted 13px/400 so it reads below the memo's own content.
 */
const MemoCommentListView: React.FC = () => {
  const t = useTranslate();
  const { memo, parentPage } = useMemoViewContext();
  const { isInMemoDetailPage, commentAmount } = useMemoViewDerived();
  const { ref: viewportRef, isNearViewport } = useNearViewport<HTMLElement>();

  const { data } = useMemoComments(memo.name, {
    enabled: isNearViewport && !isInMemoDetailPage && commentAmount > 0,
    pageSize: COMMENT_PREVIEW_LIMIT,
  });
  const comments = data?.comments ?? [];
  const displayedComments = comments.slice(0, COMMENT_PREVIEW_LIMIT);
  const { data: commentCreators } = useUsersByNames(displayedComments.map((comment) => comment.creator));

  if (isInMemoDetailPage || commentAmount === 0) {
    return null;
  }

  return (
    <section
      ref={viewportRef}
      aria-label={t("memo.comment.self")}
      className="rounded-b-mu-lg border border-t-0 border-mu-line/70 px-4 py-1"
    >
      <div className={cn(METADATA_ROW_LIST_CLASSES, "gap-0", PREVIEW_MIN_HEIGHT_CLASSES[Math.min(commentAmount, COMMENT_PREVIEW_LIMIT)])}>
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
        {commentAmount > COMMENT_PREVIEW_LIMIT && (
          <Link
            to={`/${memo.name}#${MEMO_COMMENTS_ANCHOR_ID}`}
            state={createMemoNavigationState(parentPage)}
            viewTransition
            className={METADATA_COMPACT_ROW_CLASSES}
          >
            {t("memo.comment.view-all-count", { count: commentAmount })}
          </Link>
        )}
      </div>
    </section>
  );
};

export default MemoCommentListView;
