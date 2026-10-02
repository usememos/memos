import {
  type ComponentType,
  forwardRef,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useColumnGridUntrapped } from "@/components/ColumnGrid/ColumnGridContext";
import { useResolvedUser } from "@/components/MemoContent/MentionResolutionContext";
import { focusEditorIn } from "@/components/MemoEditor/focus";
import { loadMemoEditor } from "@/components/MemoEditor/loader";
import type { MemoEditorProps } from "@/components/MemoEditor/types";
import { useAuth } from "@/contexts/AuthContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useUpdateMemo } from "@/hooks/useMemoQueries";
import { isMemoBlurred } from "@/lib/tag";
import { cn } from "@/lib/utils";
import { State } from "@/types/proto/api/v1/common_pb";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { lazyWithReload } from "@/utils/lazy";
import { canManageMemo } from "@/utils/user";
import { MemoBody, MemoCommentListView, MemoHeader } from "./components";
import MemoPinnedMark from "./components/MemoPinnedMark";
import { MEMO_CARD_BASE_CLASSES } from "./constants";
import { useImagePreview } from "./hooks";
import { computeCommentAmount, MemoViewContext } from "./MemoViewContext";
import { createMemoNavigationState, isMemoDetailPath, resolveMemoParentPage, shouldFocusMemoCard } from "./navigation";
import type { MemoViewHandle, MemoViewProps } from "./types";

const MemoShareImageDialog = lazyWithReload(() => import("../MemoActionMenu/MemoShareImageDialog"));
const PreviewImageDialog = lazyWithReload(() => import("../PreviewImageDialog"));

const MemoView = forwardRef<MemoViewHandle, MemoViewProps>((props, ref) => {
  const {
    memo: memoData,
    className,
    parentPage: parentPageProp,
    compact,
    timeDisplay,
    showCreator,
    showVisibility,
    showPinned,
    showSpace,
  } = props;
  const cardRef = useRef<HTMLDivElement>(null);
  const restoreCardFocusRef = useRef(false);
  const [showEditor, setShowEditor] = useState(false);
  // Card shortcuts are registered only while the card itself has focus (see PagedMemoList's j/k).
  const [cardFocused, setCardFocused] = useState(false);
  const [EditorComponent, setEditorComponent] = useState<ComponentType<MemoEditorProps>>();
  const [cardWidth, setCardWidth] = useState(0);

  const currentUser = useCurrentUser();
  const { userTagsSetting } = useAuth();
  const creator = useResolvedUser(memoData.creator, { enabled: Boolean(showCreator || props.shareImageDialogOpen) });
  const isArchived = memoData.state === State.ARCHIVED;
  const readonly = !canManageMemo(memoData, currentUser);
  const location = useLocation();
  const parentPage = resolveMemoParentPage({
    explicitParentPage: parentPageProp,
    pathname: location.pathname,
    search: location.search,
    memoName: memoData.name,
  });

  // Blur content when any tag has blur_content enabled in the current user's tag settings.
  const [showBlurredContent, setShowBlurredContent] = useState(false);
  const blurred = isMemoBlurred(memoData, userTagsSetting);
  const toggleBlurVisibility = useCallback(() => setShowBlurredContent((prev) => !prev), []);

  const { previewState, openPreview, setPreviewOpen } = useImagePreview();
  const editorHostRef = useRef<HTMLDivElement>(null);

  const focusMountedEditor = useCallback(() => {
    focusEditorIn(editorHostRef.current);
  }, []);

  const openEditor = useCallback(() => {
    if (showEditor && EditorComponent) {
      focusMountedEditor();
      return;
    }
    void loadMemoEditor()
      .then(({ default: MemoEditor }) => {
        setEditorComponent(() => MemoEditor);
        setShowEditor(true);
        // The editor replaces the card, and unmounting a focused element fires no blur.
        setCardFocused(false);
      })
      .catch(() => undefined);
  }, [EditorComponent, focusMountedEditor, showEditor]);
  const closeEditor = useCallback(() => {
    restoreCardFocusRef.current = true;
    setShowEditor(false);
  }, []);

  useLayoutEffect(() => {
    if (!showEditor && restoreCardFocusRef.current) {
      restoreCardFocusRef.current = false;
      // Preserve focus deliberately moved elsewhere while an asynchronous save finishes.
      if (document.activeElement === document.body) cardRef.current?.focus({ preventScroll: true });
    }
  }, [showEditor]);

  // The grid keys tiles by memo name (see getMemoKey), so the focused editor
  // identifies its own tile by name and untraps it for the duration.
  const { setUntrappedKey, clearUntrappedKey } = useColumnGridUntrapped();
  const handleFocusModeChange = useCallback(
    (isFocusMode: boolean) => {
      if (isFocusMode) {
        setUntrappedKey(memoData.name);
      } else {
        clearUntrappedKey(memoData.name);
      }
    },
    [memoData.name, setUntrappedKey, clearUntrappedKey],
  );
  // Release the slot when the editor closes or this card unmounts. Both calls
  // are ownership-scoped, so mounting cards never clobber another card's slot.
  useEffect(() => {
    if (!showEditor) {
      clearUntrappedKey(memoData.name);
    }
  }, [showEditor, memoData.name, clearUntrappedKey]);
  useEffect(() => () => clearUntrappedKey(memoData.name), [memoData.name, clearUntrappedKey]);

  useImperativeHandle(ref, () => ({ openEditor }), [openEditor]);

  const isInMemoDetailPage = isMemoDetailPath(location.pathname, memoData.name);

  // Opened with the keyboard: land focus on the card so card shortcuts (e, p) work immediately.
  const focusCardOnOpen = isInMemoDetailPage && shouldFocusMemoCard(location.state);
  useEffect(() => {
    if (focusCardOnOpen) cardRef.current?.focus();
  }, [focusCardOnOpen]);
  const showCommentPreview = !isInMemoDetailPage && computeCommentAmount(memoData) > 0;

  // The card width is only needed by the share-image dialog. Keep feed cards
  // free of a permanent ResizeObserver and measure only while that dialog is open.
  useLayoutEffect(() => {
    if (!props.shareImageDialogOpen) {
      return;
    }

    const card = cardRef.current;
    if (!card) {
      return;
    }

    const updateWidth = (nextWidth?: number) => {
      const width = Math.round(nextWidth ?? card.getBoundingClientRect().width);
      setCardWidth((prev) => (prev === width ? prev : width));
    };

    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      const handleResize = () => updateWidth();
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }

    const resizeObserver = new ResizeObserver((entries) => {
      updateWidth(entries[0]?.contentRect.width);
    });

    resizeObserver.observe(card);
    return () => resizeObserver.disconnect();
  }, [props.shareImageDialogOpen]);

  const contextValue = useMemo(
    () => ({
      memo: memoData,
      creator,
      currentUser,
      parentPage,
      cardWidth,
      isArchived,
      readonly,
      showBlurredContent,
      blurred,
      openEditor,
      toggleBlurVisibility,
      openPreview,
    }),
    [
      memoData,
      creator,
      currentUser,
      parentPage,
      cardWidth,
      isArchived,
      readonly,
      showBlurredContent,
      blurred,
      openEditor,
      toggleBlurVisibility,
      openPreview,
    ],
  );

  const article = (
    <article
      className={cn(MEMO_CARD_BASE_CLASSES, "group/memo", showCommentPreview ? "mb-0 rounded-b-none" : "mb-2", className)}
      ref={cardRef}
      tabIndex={readonly ? -1 : 0}
      data-memo-card
      onFocus={(e) => setCardFocused(e.target === e.currentTarget)}
      onBlur={(e) => e.target === e.currentTarget && setCardFocused(false)}
    >
      {cardFocused && (
        <MemoCardShortcuts
          memo={memoData}
          parentPage={parentPage}
          readonly={readonly}
          isInMemoDetailPage={isInMemoDetailPage}
          openEditor={openEditor}
        />
      )}
      {showPinned && memoData.pinned && <MemoPinnedMark />}
      <MemoHeader timeDisplay={timeDisplay} showCreator={showCreator} showVisibility={showVisibility} showSpace={showSpace} />

      <MemoBody compact={compact} />

      {previewState.items.length > 0 && (
        <Suspense fallback={null}>
          <PreviewImageDialog
            open={previewState.open}
            onOpenChange={setPreviewOpen}
            items={previewState.items}
            initialIndex={previewState.index}
          />
        </Suspense>
      )}

      {props.onShareImageDialogOpenChange && props.shareImageDialogOpen && (
        <Suspense fallback={null}>
          <MemoShareImageDialog open onOpenChange={props.onShareImageDialogOpenChange} />
        </Suspense>
      )}
    </article>
  );

  const memoDisplay = showCommentPreview ? (
    <div className="w-full mb-2">
      {article}
      <MemoCommentListView />
    </div>
  ) : (
    article
  );

  return (
    <MemoViewContext.Provider value={contextValue}>
      {showEditor && EditorComponent ? (
        <div ref={editorHostRef} className="w-full">
          <EditorComponent
            autoFocus
            className="mb-2"
            cacheKey={`inline-memo-editor-${memoData.name}`}
            memo={memoData}
            parentMemoName={memoData.parent || undefined}
            onConfirm={closeEditor}
            onCancel={closeEditor}
            onFocusModeChange={handleFocusModeChange}
          />
        </div>
      ) : (
        memoDisplay
      )}
    </MemoViewContext.Provider>
  );
});

const MemoCardShortcuts = ({
  memo,
  parentPage,
  readonly,
  isInMemoDetailPage,
  openEditor,
}: {
  memo: Memo;
  parentPage: string;
  readonly: boolean;
  isInMemoDetailPage: boolean;
  openEditor: () => void;
}) => {
  const navigate = useNavigate();
  const { mutate: updateMemo } = useUpdateMemo();
  // Same rules as MemoActionMenu: comments never open on their own or pin, archived memos neither edit nor pin.
  const isComment = Boolean(memo.parent);
  const canModify = !readonly && memo.state !== State.ARCHIVED;
  useKeyboardShortcuts({
    "memo.open":
      isComment || isInMemoDetailPage
        ? undefined
        : () => navigate(`/${memo.name}`, { state: createMemoNavigationState(parentPage, true), viewTransition: true }),
    "memo.edit": canModify ? openEditor : undefined,
    "memo.pin":
      canModify && !isComment ? () => updateMemo({ update: { name: memo.name, pinned: !memo.pinned }, updateMask: ["pinned"] }) : undefined,
  });
  return null;
};

MemoView.displayName = "MemoView";

export default memo(MemoView);
