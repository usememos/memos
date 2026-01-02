import { memo, useMemo, useRef, useState } from "react";
import { useUser } from "@/hooks/useUserQueries";
import { cn } from "@/lib/utils";
import MemoEditor from "../MemoEditor";
import PreviewImageDialog from "../PreviewImageDialog";
import { MemoBody, MemoHeader } from "./components";
import { MEMO_CARD_BASE_CLASSES } from "./constants";
import { useImagePreview, useMemoActions, useMemoHandlers, useMemoViewDerivedState, useNsfwContent } from "./hooks";
import { MemoViewContext } from "./MemoViewContext";
import type { MemoViewProps } from "./types";

const MemoView: React.FC<MemoViewProps> = (props: MemoViewProps) => {
  const { memo: memoData, className } = props;
  const cardRef = useRef<HTMLDivElement>(null);
  const [reactionSelectorOpen, setReactionSelectorOpen] = useState(false);
  const [showEditor, setShowEditor] = useState(false);

  const creator = useUser(memoData.creator).data;
  const { isArchived, readonly, parentPage } = useMemoViewDerivedState(memoData, props.parentPage);
  const { nsfw, showNSFWContent, toggleNsfwVisibility } = useNsfwContent(memoData, props.showNsfwContent);
  const { previewState, openPreview, setPreviewOpen } = useImagePreview();
  const { unpinMemo } = useMemoActions(memoData, isArchived);

  const handleEditorConfirm = () => setShowEditor(false);
  const handleEditorCancel = () => setShowEditor(false);
  const openEditor = () => setShowEditor(true);

  const { handleGotoMemoDetailPage, handleMemoContentClick, handleMemoContentDoubleClick } = useMemoHandlers({
    memoName: memoData.name,
    parentPage,
    readonly,
    openEditor,
    openPreview,
  });

  const contextValue = useMemo(
    () => ({
      memo: memoData,
      creator,
      parentPage,
      showNSFWContent,
      nsfw,
    }),
    [memoData, creator, parentPage, showNSFWContent, nsfw],
  );

  if (showEditor) {
    return (
      <MemoEditor
        autoFocus
        className="mb-2"
        cacheKey={`inline-memo-editor-${memoData.name}`}
        memoName={memoData.name}
        onConfirm={handleEditorConfirm}
        onCancel={handleEditorCancel}
      />
    );
  }

  return (
    <MemoViewContext.Provider value={contextValue}>
      <article className={cn(MEMO_CARD_BASE_CLASSES, className)} ref={cardRef} tabIndex={readonly ? -1 : 0}>
        <MemoHeader
          showCreator={props.showCreator}
          showVisibility={props.showVisibility}
          showPinned={props.showPinned}
          onEdit={openEditor}
          onGotoDetail={handleGotoMemoDetailPage}
          onUnpin={unpinMemo}
          onToggleNsfwVisibility={toggleNsfwVisibility}
          reactionSelectorOpen={reactionSelectorOpen}
          onReactionSelectorOpenChange={setReactionSelectorOpen}
        />

        <MemoBody
          compact={props.compact}
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
    </MemoViewContext.Provider>
  );
};

export default memo(MemoView);
