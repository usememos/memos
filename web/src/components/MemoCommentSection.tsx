import { Button } from "@usememos/ui";
import { MessageCircleIcon } from "lucide-react";
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { MemoEditor, preloadMemoEditing } from "@/components/MemoEditor";
import MemoView from "@/components/MemoView";
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
        <h2 id={MEMO_COMMENTS_ANCHOR_ID} className="mu-visually-hidden">
          {t("memo.comment.self")}
        </h2>
        <div className="relative mx-auto grow w-full min-h-full flex flex-col justify-start items-start gap-y-1">
          {comments.length === 0 ? (
            showCreateButton && (
              <div className="w-full flex flex-row justify-center items-center py-6">
                <Button
                  variant="ghost"
                  iconEnd={<MessageCircleIcon />}
                  onPointerEnter={preloadEditor}
                  onFocus={preloadEditor}
                  onClick={openEditor}
                >
                  {t("memo.comment.write-a-comment")}
                </Button>
              </div>
            )
          ) : (
            <div className="w-full flex flex-row justify-between items-center h-8 pl-3 mb-2">
              <div className="flex flex-row justify-start items-center">
                <MessageCircleIcon className="mu-icon w-5 h-auto text-mu-text-secondary mr-1" />
                <span className="text-mu-text-secondary mu-body">{t("memo.comment.self")}</span>
                {/* The count sits beside the label as a plain number, as it does on a card's comment strip and in the sidebar. */}
                <span className="text-mu-text-secondary mu-caption tabular-nums ml-1.5">{commentCount}</span>
              </div>
              {showCreateButton && (
                <Button variant="ghost" onPointerEnter={preloadEditor} onFocus={preloadEditor} onClick={openEditor}>
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
              <Button
                variant="neutral"
                onClick={onLoadMoreComments}
                loading={isFetchingMoreComments}
                loadingLabel={t("resource.fetching-data")}
              >
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
