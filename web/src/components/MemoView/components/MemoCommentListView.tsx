import { ArrowUpRightIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { extractMemoIdFromName } from "@/helpers/resource-names";
import { useMemoComments } from "@/hooks/useMemoQueries";
import { useMemoViewContext, useMemoViewDerived } from "../MemoViewContext";
import MemoSnippetLink from "./MemoSnippetLink";

const MemoCommentListView: React.FC = () => {
  const { memo } = useMemoViewContext();
  const { isInMemoDetailPage, commentAmount } = useMemoViewDerived();

  const { data } = useMemoComments(memo.name, { enabled: !isInMemoDetailPage && commentAmount > 0 });
  const comments = data?.memos ?? [];

  if (isInMemoDetailPage || commentAmount === 0) {
    return null;
  }

  const displayedComments = comments.slice(0, 3);

  return (
    <div className="border border-t-0 border-border rounded-b-xl px-4 pt-2 pb-3 flex flex-col gap-1">
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
        return (
          <MemoSnippetLink
            key={comment.name}
            name={comment.name}
            snippet={comment.snippet || comment.content}
            to={`/${memo.name}#${uid}`}
            className="bg-muted/40 rounded-md"
          />
        );
      })}
    </div>
  );
};

export default MemoCommentListView;
