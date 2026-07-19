import { ArrowUpRightIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { MemoPreview } from "@/components/MemoPreview";
import { useMemoComments } from "@/hooks/useMemoQueries";
import { useNearViewport } from "@/hooks/useNearViewport";
import { useUsersByNames } from "@/hooks/useUserQueries";
import { extractMemoIdFromName } from "@/lib/resource-names";
import { useMemoViewContext, useMemoViewDerived } from "../MemoViewContext";

const MemoCommentListView: React.FC = () => {
  const { memo } = useMemoViewContext();
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
    <div ref={viewportRef} className="border border-t-0 border-border rounded-b-lg px-4 pt-2 pb-3 flex flex-col gap-1">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">Comments{commentAmount > 1 ? ` (${commentAmount})` : ""}</span>
        <Link
          to={`/${memo.name}#comments`}
          className="flex items-center gap-0.5 text-xs text-muted-foreground/80 hover:underline underline-offset-2 transition-colors"
        >
          View all
          <ArrowUpRightIcon className="w-3 h-3" />
        </Link>
      </div>
      {displayedComments.map((comment) => {
        const uid = extractMemoIdFromName(comment.name);
        const creator = commentCreators?.get(comment.creator);
        return (
          <Link
            key={comment.name}
            to={`/${memo.name}#${uid}`}
            viewTransition
            className="rounded-md bg-muted/40 px-2 py-1 transition-colors hover:bg-muted/60"
          >
            <MemoPreview
              content={comment.snippet || comment.content}
              attachments={comment.attachments}
              creator={creator}
              showCreator
              truncate
            />
          </Link>
        );
      })}
    </div>
  );
};

export default MemoCommentListView;
