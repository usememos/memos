import { MessageCircleIcon } from "lucide-react";
import { useState } from "react";
import MemoEditor from "@/components/MemoEditor";
import MemoView from "@/components/MemoView";
import { Button } from "@/components/ui/button";
import { extractMemoIdFromName } from "@/helpers/resource-names";
import useCurrentUser from "@/hooks/useCurrentUser";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";

interface Props {
  memo: Memo;
  comments: Memo[];
  parentPage?: string;
}

const MemoCommentSection = ({ memo, comments, parentPage }: Props) => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const [showEditor, setShowEditor] = useState(false);

  const showCreateButton = currentUser && !showEditor;

  const handleCommentCreated = async (_memoCommentName: string) => {
    setShowEditor(false);
  };

  return (
    <div className="pt-8 pb-16 w-full">
      <h2 id="comments" className="sr-only">
        {t("memo.comment.self")}
      </h2>
      <div className="relative mx-auto grow w-full min-h-full flex flex-col justify-start items-start gap-y-1">
        {comments.length === 0 ? (
          showCreateButton && (
            <div className="w-full flex flex-row justify-center items-center py-6">
              <Button variant="ghost" onClick={() => setShowEditor(true)}>
                <span className="text-muted-foreground">{t("memo.comment.write-a-comment")}</span>
                <MessageCircleIcon className="ml-2 w-5 h-auto text-muted-foreground" />
              </Button>
            </div>
          )
        ) : (
          <div className="w-full flex flex-row justify-between items-center h-8 pl-3 mb-2">
            <div className="flex flex-row justify-start items-center">
              <MessageCircleIcon className="w-5 h-auto text-muted-foreground mr-1" />
              <span className="text-muted-foreground text-sm">{t("memo.comment.self")}</span>
              <span className="text-muted-foreground text-sm ml-1">({comments.length})</span>
            </div>
            {showCreateButton && (
              <Button variant="ghost" className="text-muted-foreground" onClick={() => setShowEditor(true)}>
                {t("memo.comment.write-a-comment")}
              </Button>
            )}
          </div>
        )}
        {showEditor && (
          <div className="w-full mb-2">
            <MemoEditor
              cacheKey={`${memo.name}-${memo.updateTime}-comment`}
              placeholder={t("editor.add-your-comment-here")}
              parentMemoName={memo.name}
              autoFocus
              onConfirm={handleCommentCreated}
              onCancel={() => setShowEditor(false)}
            />
          </div>
        )}
        {comments.map((comment) => (
          <div className="w-full" key={`${comment.name}-${comment.displayTime}`} id={extractMemoIdFromName(comment.name)}>
            <MemoView memo={comment} parentPage={parentPage} showCreator compact />
          </div>
        ))}
      </div>
    </div>
  );
};

export default MemoCommentSection;
