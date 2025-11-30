import { observer } from "mobx-react-lite";
import { memo, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import MemoEditor from "../MemoEditor";
import PreviewImageDialog from "../PreviewImageDialog";
import { MemoBody, MemoHeader } from "./components";
import { MEMO_CARD_BASE_CLASSES } from "./constants";
import {
  useImagePreview,
  useKeyboardShortcuts,
  useMemoActions,
  useMemoCreator,
  useMemoEditor,
  useMemoHandlers,
  useMemoViewDerivedState,
  useNsfwContent,
} from "./hooks";
import { MemoViewContext } from "./MemoViewContext";
import type { MemoViewProps } from "./types";

/**
 * MemoView component displays a single memo card with full functionality including:
 * - Creator information and display time
 * - Memo content with markdown rendering
 * - Attachments and location
 * - Reactions and comments
 * - Edit mode with inline editor
 * - Keyboard shortcuts for quick actions
 * - NSFW content blur protection
 */
const MemoView: React.FC<MemoViewProps> = observer((props: MemoViewProps) => {
  const { memo: memoData, className } = props;
  const cardRef = useRef<HTMLDivElement>(null);

  // State
  const [reactionSelectorOpen, setReactionSelectorOpen] = useState(false);

  // Custom hooks for data fetching
  const creator = useMemoCreator(memoData.creator);

  // Custom hooks for derived state
  const { commentAmount, relativeTimeFormat, isArchived, readonly, isInMemoDetailPage, parentPage } = useMemoViewDerivedState({
    memo: memoData,
    parentPage: props.parentPage,
  });

  // Custom hooks for UI state management
  const { nsfw, showNSFWContent, toggleNsfwVisibility } = useNsfwContent(memoData, props.showNsfwContent);
  const { previewState, openPreview, setPreviewOpen } = useImagePreview();
  const { showEditor, openEditor, handleEditorConfirm, handleEditorCancel } = useMemoEditor();

  // Custom hooks for actions
  const { archiveMemo, unpinMemo } = useMemoActions(memoData);
  const { handleGotoMemoDetailPage, handleMemoContentClick, handleMemoContentDoubleClick } = useMemoHandlers({
    memoName: memoData.name,
    parentPage,
    readonly,
    openEditor,
    openPreview,
  });

  // Keyboard shortcuts
  const { handleShortcutActivation } = useKeyboardShortcuts(cardRef, {
    enabled: true,
    readonly,
    showEditor,
    isArchived,
    onEdit: openEditor,
    onArchive: archiveMemo,
  });

  // Memoize context value to prevent unnecessary re-renders
  // IMPORTANT: This must be before the early return to satisfy Rules of Hooks
  const contextValue = useMemo(
    () => ({
      memo: memoData,
      creator,
      isArchived,
      readonly,
      isInMemoDetailPage,
      parentPage,
      commentAmount,
      relativeTimeFormat,
      nsfw,
      showNSFWContent,
    }),
    [memoData, creator, isArchived, readonly, isInMemoDetailPage, parentPage, commentAmount, relativeTimeFormat, nsfw, showNSFWContent],
  );

  // Render inline editor when editing
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

  // Render memo card
  return (
    <MemoViewContext.Provider value={contextValue}>
      <article
        className={cn(MEMO_CARD_BASE_CLASSES, className)}
        ref={cardRef}
        tabIndex={readonly ? -1 : 0}
        onFocus={() => handleShortcutActivation(true)}
        onBlur={() => handleShortcutActivation(false)}
      >
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
});

export default memo(MemoView);
