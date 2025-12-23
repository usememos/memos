import { observer } from "mobx-react-lite";
import { memo, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
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

interface Props {
  memo: Memo;
  compact?: boolean;
  showCreator?: boolean;
  showVisibility?: boolean;
  showPinned?: boolean;
  showNsfwContent?: boolean;
  className?: string;
  parentPage?: string;
}

/**
 * MemoView component displays a memo card with all its content, metadata, and interactive elements.
 *
 * Features:
 * - Displays memo content with markdown rendering
 * - Shows creator information and timestamps
 * - Supports inline editing with keyboard shortcuts (e = edit, a = archive)
 * - Handles NSFW content blurring
 * - Image preview on click
 * - Comments, reactions, and relations
 *
 * @example
 * ```tsx
 * <MemoView
 *   memo={memoData}
 *   showCreator
 *   showVisibility
 *   compact={false}
 * />
 * ```
 */
const MemoView: React.FC<Props> = observer((props: Props) => {
  const { memo: memoData, className } = props;
  const cardRef = useRef<HTMLDivElement>(null);
  const [reactionSelectorOpen, setReactionSelectorOpen] = useState(false);

  const creator = useMemoCreator(memoData.creator);
  const { commentAmount, relativeTimeFormat, isArchived, readonly, isInMemoDetailPage, parentPage } = useMemoViewDerivedState(
    memoData,
    props.parentPage,
  );
  const { nsfw, showNSFWContent, toggleNsfwVisibility } = useNsfwContent(memoData, props.showNsfwContent);
  const { previewState, openPreview, setPreviewOpen } = useImagePreview();
  const { showEditor, openEditor, handleEditorConfirm, handleEditorCancel } = useMemoEditor();
  const { archiveMemo, unpinMemo } = useMemoActions(memoData);
  const { handleGotoMemoDetailPage, handleMemoContentClick, handleMemoContentDoubleClick } = useMemoHandlers({
    memoName: memoData.name,
    parentPage,
    readonly,
    openEditor,
    openPreview,
  });
  useKeyboardShortcuts(cardRef, {
    enabled: true,
    readonly,
    showEditor,
    isArchived,
    onEdit: openEditor,
    onArchive: archiveMemo,
  });

  // Memoize static values that rarely change
  const staticContextValue = useMemo(
    () => ({
      memo: memoData,
      creator,
      isArchived,
      readonly,
      isInMemoDetailPage,
      parentPage,
    }),
    [memoData, creator, isArchived, readonly, isInMemoDetailPage, parentPage],
  );

  // Memoize dynamic values separately
  const dynamicContextValue = useMemo(
    () => ({
      commentAmount,
      relativeTimeFormat,
      nsfw,
      showNSFWContent,
    }),
    [commentAmount, relativeTimeFormat, nsfw, showNSFWContent],
  );

  // Combine context values
  const contextValue = useMemo(
    () => ({
      ...staticContextValue,
      ...dynamicContextValue,
    }),
    [staticContextValue, dynamicContextValue],
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
});

export default memo(MemoView);
