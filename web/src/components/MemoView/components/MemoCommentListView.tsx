import { ArrowUpRightIcon, MessageCircleIcon } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import MemoEditor from "@/components/MemoEditor";
import { MemoPreview } from "@/components/MemoPreview";
import { Button } from "@/components/ui/button";
import { extractMemoIdFromName } from "@/helpers/resource-names";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useMemoComments } from "@/hooks/useMemoQueries";
import { useUsersByNames } from "@/hooks/useUserQueries";
import { useTranslate } from "@/utils/i18n";
import { useMemoViewContext, useMemoViewDerived } from "../MemoViewContext";

const MemoCommentListView: React.FC = () => {
  const t = useTranslate();
  const { memo } = useMemoViewContext();
  const { isInMemoDetailPage, commentAmount } = useMemoViewDerived();
  const currentUser = useCurrentUser();
  const [showEditor, setShowEditor] = useState(false);

  const { data } = useMemoComments(memo.name, { enabled: !isInMemoDetailPage && commentAmount > 0, pageSize: 3 });
  const comments = data?.memos ?? [];
  const displayedComments = comments.slice(0, 3);
  const { data: commentCreators } = useUsersByNames(displayedComments.map((comment) => comment.creator));

  if (isInMemoDetailPage) {
    return null;
  }

  const hasComments = commentAmount > 0;
  const showCreateButton = currentUser && !showEditor;

  const handleCommentCreated = async (_memoCommentName: string) => {
    setShowEditor(false);
  };

  return (
    <div className="border border-t-0 border-border rounded-b-lg px-4 pt-2 pb-3 flex flex-col gap-1">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          <MessageCircleIcon className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {t("memo.comment.self")}
            {commentAmount > 0 && ` (${commentAmount})`}
          </span>
        </div>
        {hasComments && (
          <Link
            to={`/${memo.name}#comments`}
            className="flex items-center gap-0.5 text-xs text-muted-foreground/80 hover:underline underline-offset-2 transition-colors"
          >
            {t("memo.comment.view-all")}
            <ArrowUpRightIcon className="w-3 h-3" />
          </Link>
        )}
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

      {showEditor && (
        <div className="mt-2">
          <MemoEditor
            cacheKey={`${memo.name}-inline-comment`}
            placeholder={t("editor.add-your-comment-here")}
            parentMemoName={memo.name}
            autoFocus
            onConfirm={handleCommentCreated}
            onCancel={() => setShowEditor(false)}
          />
        </div>
      )}

      {showCreateButton && !hasComments && (
        <Button variant="ghost" size="sm" className="w-full mt-1 text-muted-foreground" onClick={() => setShowEditor(true)}>
          <MessageCircleIcon className="w-4 h-4 mr-1" />
          {t("memo.comment.write-a-comment")}
        </Button>
      )}
    </div>
  );
};

export default MemoCommentListView;
