import { LoaderCircleIcon, MessageCircleIcon } from "lucide-react";
import { type ComponentType, useCallback, useState } from "react";
import { loadMemoEditor } from "@/components/MemoEditor/loader";
import type { MemoEditorProps } from "@/components/MemoEditor/types";
import MemoView from "@/components/MemoView";
import { Button } from "@/components/ui/button";
import useCurrentUser from "@/hooks/useCurrentUser";
import { extractMemoIdFromName } from "@/lib/resource-names";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";

interface Props {
  memo: Memo;
  comments: Memo[];
  parentPage?: string;
  hasMoreComments?: boolean;
  isFetchingMoreComments?: boolean;
  onLoadMoreComments?: () => void;
}

const MemoCommentSection = ({ memo, comments, parentPage, hasMoreComments, isFetchingMoreComments, onLoadMoreComments }: Props) => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const [showEditor, setShowEditor] = useState(false);
  const [isEditorLoading, setIsEditorLoading] = useState(false);
  const [EditorComponent, setEditorComponent] = useState<ComponentType<MemoEditorProps>>();

  const showCreateButton = currentUser && !showEditor;

  const handleCommentCreated = async (_memoCommentName: string) => {
    setShowEditor(false);
  };

  const preloadEditor = useCallback(() => {
    void loadMemoEditor().catch(() => undefined);
  }, []);

  const openEditor = useCallback(async () => {
    if (isEditorLoading) {
      return;
    }

    setIsEditorLoading(true);
    try {
      const { default: MemoEditor } = await loadMemoEditor();
      setEditorComponent(() => MemoEditor);
      setShowEditor(true);
    } catch {
      // Chunk failures are handled by loadWithReload; keep the current UI mounted.
    } finally {
      setIsEditorLoading(false);
    }
  }, [isEditorLoading]);

  return (
    <div className="pt-8 pb-16 w-full">
      <h2 id="comments" className="sr-only">
        {t("memo.comment.self")}
      </h2>
      <div className="relative mx-auto grow w-full min-h-full flex flex-col justify-start items-start gap-y-1">
        {comments.length === 0 ? (
          showCreateButton && (
            <div className="w-full flex flex-row justify-center items-center py-6">
              <Button
                variant="ghost"
                onPointerEnter={preloadEditor}
                onFocus={preloadEditor}
                onClick={openEditor}
                disabled={isEditorLoading}
              >
                <span className="text-muted-foreground">{t("memo.comment.write-a-comment")}</span>
                {isEditorLoading ? (
                  <LoaderCircleIcon className="ml-2 h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <MessageCircleIcon className="ml-2 w-5 h-auto text-muted-foreground" />
                )}
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
              <Button
                variant="ghost"
                className="text-muted-foreground"
                onPointerEnter={preloadEditor}
                onFocus={preloadEditor}
                onClick={openEditor}
                disabled={isEditorLoading}
              >
                {isEditorLoading && <LoaderCircleIcon className="h-4 w-4 animate-spin" />}
                {t("memo.comment.write-a-comment")}
              </Button>
            )}
          </div>
        )}
        {showEditor && EditorComponent && (
          <div className="w-full mb-2">
            <EditorComponent
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
          <div className="w-full" key={`${comment.name}-${comment.updateTime}`} id={extractMemoIdFromName(comment.name)}>
            <MemoView memo={comment} parentPage={parentPage} showCreator compact />
          </div>
        ))}
        {hasMoreComments && (
          <div className="w-full mt-4 flex justify-center">
            <Button variant="outline" className="rounded-full px-4" onClick={onLoadMoreComments} disabled={isFetchingMoreComments}>
              {isFetchingMoreComments && <LoaderCircleIcon className="h-4 w-4 animate-spin" />}
              {t(isFetchingMoreComments ? "resource.fetching-data" : "memo.load-more")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MemoCommentSection;
