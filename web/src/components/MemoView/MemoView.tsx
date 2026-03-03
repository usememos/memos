import { memo, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useUser } from "@/hooks/useUserQueries";
import { cn } from "@/lib/utils";
import { State } from "@/types/proto/api/v1/common_pb";
import { isSuperUser } from "@/utils/user";
import MemoEditor from "../MemoEditor";
import PreviewImageDialog from "../PreviewImageDialog";
import { MemoBody, MemoCommentListView, MemoHeader } from "./components";
import { MEMO_CARD_BASE_CLASSES } from "./constants";
import { useImagePreview, useMemoActions, useMemoHandlers } from "./hooks";
import { computeCommentAmount, MemoViewContext } from "./MemoViewContext";
import type { MemoViewProps } from "./types";

const MemoView: React.FC<MemoViewProps> = (props: MemoViewProps) => {
  const { memo: memoData, className, parentPage: parentPageProp, compact, showCreator, showVisibility, showPinned } = props;
  const cardRef = useRef<HTMLDivElement>(null);
  const [showEditor, setShowEditor] = useState(false);

  const currentUser = useCurrentUser();
  const creator = useUser(memoData.creator).data;
  const isArchived = memoData.state === State.ARCHIVED;
  const readonly = memoData.creator !== currentUser?.name && !isSuperUser(currentUser);
  const parentPage = parentPageProp || "/";

  // NSFW content management: always blur content tagged with NSFW (case-insensitive)
  const [showNSFWContent, setShowNSFWContent] = useState(false);
  const nsfw = memoData.tags?.some((tag) => tag.toUpperCase() === "NSFW") ?? false;
  const toggleNsfwVisibility = () => setShowNSFWContent((prev) => !prev);

  const { previewState, openPreview, setPreviewOpen } = useImagePreview();
  const { unpinMemo } = useMemoActions(memoData);

  const closeEditor = () => setShowEditor(false);
  const openEditor = () => setShowEditor(true);

  const { handleGotoMemoDetailPage, handleMemoContentClick, handleMemoContentDoubleClick } = useMemoHandlers({
    memoName: memoData.name,
    parentPage,
    readonly,
    openEditor,
    openPreview,
  });

  const location = useLocation();
  const isInMemoDetailPage = location.pathname.startsWith(`/${memoData.name}`);
  const showCommentPreview = !isInMemoDetailPage && computeCommentAmount(memoData) > 0;

  const contextValue = useMemo(
    () => ({
      memo: memoData,
      creator,
      currentUser,
      parentPage,
      isArchived,
      readonly,
      showNSFWContent,
      nsfw,
    }),
    [memoData, creator, currentUser, parentPage, isArchived, readonly, showNSFWContent, nsfw],
  );

  if (showEditor) {
    return (
      <MemoEditor
        autoFocus
        className="mb-2"
        cacheKey={`inline-memo-editor-${memoData.name}`}
        memo={memoData}
        onConfirm={closeEditor}
        onCancel={closeEditor}
      />
    );
  }

  const article = (
    <article
      className={cn(MEMO_CARD_BASE_CLASSES, showCommentPreview ? "mb-0 rounded-b-none" : "mb-2", className)}
      ref={cardRef}
      tabIndex={readonly ? -1 : 0}
    >
      <MemoHeader
        showCreator={showCreator}
        showVisibility={showVisibility}
        showPinned={showPinned}
        onEdit={openEditor}
        onGotoDetail={handleGotoMemoDetailPage}
        onUnpin={unpinMemo}
      />

      <MemoBody
        compact={compact}
        onContentClick={handleMemoContentClick}
        onContentDoubleClick={handleMemoContentDoubleClick}
        onToggleNsfwVisibility={toggleNsfwVisibility}
      />

      <PreviewImageDialog
        open={previewState.open}
        onOpenChange={setPreviewOpen}
        imgUrls={previewState.urls}
        initialIndex={previewState.index}
      />
    </article>
  );

  return (
    <MemoViewContext.Provider value={contextValue}>
      {showCommentPreview ? (
        <div className="mb-2">
          {article}
          <MemoCommentListView />
        </div>
      ) : (
        article
      )}
    </MemoViewContext.Provider>
  );
};

export default memo(MemoView);
