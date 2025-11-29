import { observer } from "mobx-react-lite";
import { memo, useCallback, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import useCurrentUser from "@/hooks/useCurrentUser";
import useNavigateTo from "@/hooks/useNavigateTo";
import { cn } from "@/lib/utils";
import { instanceStore, userStore } from "@/store";
import { State } from "@/types/proto/api/v1/common";
import { MemoRelation_Type } from "@/types/proto/api/v1/memo_service";
import { isSuperUser } from "@/utils/user";
import MemoEditor from "../MemoEditor";
import PreviewImageDialog from "../PreviewImageDialog";
import { MemoBody, MemoHeader } from "./components";
import { MEMO_CARD_BASE_CLASSES, RELATIVE_TIME_THRESHOLD_MS } from "./constants";
import { useImagePreview, useKeyboardShortcuts, useMemoActions, useMemoCreator, useNsfwContent } from "./hooks";
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
  const location = useLocation();
  const navigateTo = useNavigateTo();
  const user = useCurrentUser();
  const cardRef = useRef<HTMLDivElement>(null);

  // State
  const [showEditor, setShowEditor] = useState(false);
  const [reactionSelectorOpen, setReactionSelectorOpen] = useState(false);

  // Fetch creator data
  const creator = useMemoCreator(memoData.creator);

  // Custom hooks for state management
  const { nsfw, showNSFWContent, toggleNsfwVisibility } = useNsfwContent(memoData, props.showNsfwContent);
  const { previewState, openPreview, setPreviewOpen } = useImagePreview();
  const { archiveMemo, unpinMemo } = useMemoActions(memoData);

  // Derived state
  const instanceMemoRelatedSetting = instanceStore.state.memoRelatedSetting;
  const commentAmount = memoData.relations.filter(
    (relation) => relation.type === MemoRelation_Type.COMMENT && relation.relatedMemo?.name === memoData.name,
  ).length;
  const relativeTimeFormat =
    memoData.displayTime && Date.now() - memoData.displayTime.getTime() > RELATIVE_TIME_THRESHOLD_MS ? "datetime" : "auto";
  const isArchived = memoData.state === State.ARCHIVED;
  const readonly = memoData.creator !== user?.name && !isSuperUser(user);
  const isInMemoDetailPage = location.pathname.startsWith(`/${memoData.name}`);
  const parentPage = props.parentPage || location.pathname;

  // Keyboard shortcuts
  const { handleShortcutActivation } = useKeyboardShortcuts(cardRef, {
    enabled: true,
    readonly,
    showEditor,
    isArchived,
    onEdit: () => setShowEditor(true),
    onArchive: archiveMemo,
  });

  // Handlers
  const handleGotoMemoDetailPage = useCallback(() => {
    navigateTo(`/${memoData.name}`, {
      state: { from: parentPage },
    });
  }, [memoData.name, parentPage, navigateTo]);

  const handleMemoContentClick = useCallback(
    (e: React.MouseEvent) => {
      const targetEl = e.target as HTMLElement;

      if (targetEl.tagName === "IMG") {
        // Check if the image is inside a link
        const linkElement = targetEl.closest("a");
        if (linkElement) {
          // If image is inside a link, only navigate to the link (don't show preview)
          return;
        }

        const imgUrl = targetEl.getAttribute("src");
        if (imgUrl) {
          openPreview(imgUrl);
        }
      }
    },
    [openPreview],
  );

  const handleMemoContentDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (readonly) return;

      if (instanceMemoRelatedSetting.enableDoubleClickEdit) {
        e.preventDefault();
        setShowEditor(true);
      }
    },
    [readonly, instanceMemoRelatedSetting.enableDoubleClickEdit],
  );

  const handleEditorConfirm = useCallback(() => {
    setShowEditor(false);
    userStore.setStatsStateId();
  }, []);

  const handleEditorCancel = useCallback(() => {
    setShowEditor(false);
  }, []);

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
    <article
      className={cn(MEMO_CARD_BASE_CLASSES, className)}
      ref={cardRef}
      tabIndex={readonly ? -1 : 0}
      onFocus={() => handleShortcutActivation(true)}
      onBlur={() => handleShortcutActivation(false)}
    >
      <MemoHeader
        memo={memoData}
        creator={creator}
        showCreator={props.showCreator}
        showVisibility={props.showVisibility}
        showPinned={props.showPinned}
        isArchived={isArchived}
        commentAmount={commentAmount}
        isInMemoDetailPage={isInMemoDetailPage}
        parentPage={parentPage}
        readonly={readonly}
        relativeTimeFormat={relativeTimeFormat}
        onEdit={() => setShowEditor(true)}
        onGotoDetail={handleGotoMemoDetailPage}
        onUnpin={unpinMemo}
        onToggleNsfwVisibility={toggleNsfwVisibility}
        nsfw={nsfw}
        showNSFWContent={showNSFWContent}
        reactionSelectorOpen={reactionSelectorOpen}
        onReactionSelectorOpenChange={setReactionSelectorOpen}
      />

      <MemoBody
        memo={memoData}
        readonly={readonly}
        compact={props.compact}
        parentPage={parentPage}
        nsfw={nsfw}
        showNSFWContent={showNSFWContent}
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
});

export default memo(MemoView);
