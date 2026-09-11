import { ArrowUpRightIcon } from "lucide-react";
import { Link } from "react-router-dom";
import MetadataSection, { METADATA_ROW_CLASSES, METADATA_ROW_SLOT_CLASSES } from "@/components/MemoMetadata/MetadataSection";
import { MemoPreview } from "@/components/MemoPreview";
import { buttonVariants } from "@/components/ui/button";
import { useMemoComments } from "@/hooks/useMemoQueries";
import { useNearViewport } from "@/hooks/useNearViewport";
import { useUsersByNames } from "@/hooks/useUserQueries";
import { MEMO_COMMENTS_ANCHOR_ID } from "@/lib/memo-comments";
import { extractMemoIdFromName } from "@/lib/resource-names";
import { useTranslate } from "@/utils/i18n";
import UserAvatar from "../../UserAvatar";
import { useMemoViewContext, useMemoViewDerived } from "../MemoViewContext";
import { createMemoNavigationState } from "../navigation";

const VIEW_ALL_CLASSES = buttonVariants({ variant: "quiet", size: "sm" });

/**
 * The comment strip hangs off the card's bottom edge: a titled list of up to three
 * comments, each a row whose avatar sits in the leading slot on the card's text edge.
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
  const comments = data?.memos ?? [];
  const displayedComments = comments.slice(0, 3);
  const { data: commentCreators } = useUsersByNames(displayedComments.map((comment) => comment.creator));

  if (isInMemoDetailPage || commentAmount === 0) {
    return null;
  }

  return (
    <div ref={viewportRef} className="rounded-b-lg border border-t-0 border-border/70 px-4 pb-2 pt-1.5">
      <MetadataSection
        title={t("memo.comment.self")}
        count={commentAmount}
        action={
          <Link to={`/${memo.name}#${MEMO_COMMENTS_ANCHOR_ID}`} state={createMemoNavigationState(parentPage)} className={VIEW_ALL_CLASSES}>
            {t("common.view-all")}
            <ArrowUpRightIcon className="size-3" strokeWidth={1.8} />
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
              className={METADATA_ROW_CLASSES}
            >
              <span className={METADATA_ROW_SLOT_CLASSES} aria-hidden="true">
                <UserAvatar className="size-4 rounded-[4px]" avatarUrl={creator?.avatarUrl} />
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
