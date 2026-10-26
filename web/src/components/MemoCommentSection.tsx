import { LoaderCircleIcon, MessageCircleIcon } from "lucide-react";
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { MemoEditor, preloadMemoEditing } from "@/components/MemoEditor";
import MemoView from "@/components/MemoView";
import { Button } from "@/components/ui/button";
import useCurrentUser from "@/hooks/useCurrentUser";
import { MEMO_COMMENTS_ANCHOR_ID } from "@/lib/memo-comments";
import { extractMemoIdFromName } from "@/lib/resource-names";
import { State } from "@/types/proto/api/common_pb";
import type { Memo } from "@/types/proto/api/memo_service_pb";
import { useTranslate } from "@/utils/i18n";

interface Props {
  memo: Memo;
  comments: Memo[];
  commentCount?: number;
  parentPage?: string;
  hasMoreComments?: boolean;
  isFetchingMoreComments?: boolean;
  onLoadMoreComments?: () => void;
}

export interface MemoCommentSectionHandle {
  openEditor: () => Promise<void>;
  scrollIntoView: () => void;
}

const MemoCommentSection = forwardRef<MemoCommentSectionHandle, Props>(
  ({ memo, comments, commentCount = comments.length, parentPage, hasMoreComments, isFetchingMoreComments, onLoadMoreComments }, ref) => {
    const t = useTranslate();
    const currentUser = useCurrentUser();
    const [showEditor, setShowEditor] = useState(false);
    const sectionRef = useRef<HTMLDivElement>(null);

    const canCreateComment = !!currentUser && memo.state === State.NORMAL;
    const showCreateButton = canCreateComment && !showEditor;

    const handleCommentCreated = async (_memoCommentName: string) => {
      setShowEditor(false);
    };

    // The editing session's code loads while the pointer is still on the button.
    const preloadEditor = useCallback(() => preloadMemoEditing(), []);

    const focusMountedEditor = useCallback(() => {
      const editorRoot = sectionRef.current?.querySelector<HTMLElement>('.memo-editor-root[contenteditable="true"]');
      const fallbackInput = sectionRef.current?.querySelector<HTMLElement>("textarea, input");
      (editorRoot ?? fallbackInput)?.focus();
    }, []);

    const openEditor = useCallback(async () => {
      if (!canCreateComment) {
        return;
      }
      if (showEditor) {
        focusMountedEditor();
        return;
      }
      setShowEditor(true);
    }, [canCreateComment, focusMountedEditor, showEditor]);

    const scrollIntoView = useCallback(() => {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, []);

    useImperativeHandle(ref, () => ({ openEditor, scrollIntoView }), [openEditor, scrollIntoView]);

    return (
      <div ref={sectionRef} className="pt-8 pb-16 w-full" data-memo-comments-section>
        <h2 id={MEMO_COMMENTS_ANCHOR_ID} className="sr-only">
          {t("memo.comment.self")}
        </h2>
        <div className="relative mx-auto grow w-full min-h-full flex flex-col justify-start items-start gap-y-1">
          {comments.length === 0 ? (
            showCreateButton && (
              <div className="w-full flex flex-row justify-center items-center py-6">
                <Button variant="ghost" onPointerEnter={preloadEditor} onFocus={preloadEditor} onClick={openEditor}>
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
                <span className="text-muted-foreground text-sm ml-1">({commentCount})</span>
              </div>
              {showCreateButton && (
                <Button
                  variant="ghost"
                  className="text-muted-foreground"
                  onPointerEnter={preloadEditor}
                  onFocus={preloadEditor}
                  onClick={openEditor}
                >
                  {t("memo.comment.write-a-comment")}
                </Button>
              )}
            </div>
          )}
          {showEditor && (
            <div className="w-full mb-2">
              <MemoEditor
                draft={{ parent: memo.name }}
                placeholder={t("editor.add-your-comment-here")}
                autoFocus
                onConfirm={handleCommentCreated}
                onCancel={() => setShowEditor(false)}
              />
            </div>
          )}
          {comments.map((comment) => (
            <div className="w-full" key={comment.name} id={extractMemoIdFromName(comment.name)}>
              <MemoView memo={comment} parentPage={parentPage} showCreator showSpace compact />
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
  },
);

MemoCommentSection.displayName = "MemoCommentSection";

export default MemoCommentSection;
