import { ArchiveIcon, ArchiveRestoreIcon } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useLocation } from "react-router-dom";
import { useInstance } from "@/contexts/InstanceContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import useMediaQuery from "@/hooks/useMediaQuery";
import { useDeleteMemo, useUpdateMemo } from "@/hooks/useMemoQueries";
import { useUser } from "@/hooks/useUserQueries";
import { handleError } from "@/lib/error";
import { findTagMetadata } from "@/lib/tag";
import { cn } from "@/lib/utils";
import { State } from "@/types/proto/api/v1/common_pb";
import { useTranslate } from "@/utils/i18n";
import { isSuperUser } from "@/utils/user";
import MemoShareImageDialog from "../MemoActionMenu/MemoShareImageDialog";
import MemoEditor from "../MemoEditor";
import PreviewImageDialog from "../PreviewImageDialog";
import { MemoBody, MemoCommentListView, MemoHeader, MemoSwipeActions } from "./components";
import { MEMO_CARD_BASE_CLASSES } from "./constants";
import { useImagePreview } from "./hooks";
import { computeCommentAmount, MemoViewContext } from "./MemoViewContext";
import type { MemoViewProps } from "./types";

const MemoView: React.FC<MemoViewProps> = (props: MemoViewProps) => {
  const { memo: memoData, className, parentPage: parentPageProp, compact, showCreator, showVisibility, showPinned } = props;
  const cardRef = useRef<HTMLDivElement>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [cardWidth, setCardWidth] = useState(0);

  const currentUser = useCurrentUser();
  const { tagsSetting } = useInstance();
  const creator = useUser(memoData.creator).data;
  const isArchived = memoData.state === State.ARCHIVED;
  const readonly = memoData.creator !== currentUser?.name && !isSuperUser(currentUser);
  const parentPage = parentPageProp || "/";

  // Blur content when any tag has blur_content enabled in the instance tag settings.
  const [showBlurredContent, setShowBlurredContent] = useState(false);
  const blurred = memoData.tags?.some((tag) => findTagMetadata(tag, tagsSetting)?.blurContent) ?? false;
  const toggleBlurVisibility = useCallback(() => setShowBlurredContent((prev) => !prev), []);

  const { previewState, openPreview, setPreviewOpen } = useImagePreview();

  const openEditor = useCallback(() => setShowEditor(true), []);
  const closeEditor = useCallback(() => setShowEditor(false), []);

  const location = useLocation();
  const isInMemoDetailPage = location.pathname.startsWith(`/${memoData.name}`) || location.pathname.startsWith("/memos/shares/");
  const showCommentPreview = !isInMemoDetailPage && computeCommentAmount(memoData) > 0;

  const t = useTranslate();
  const isDesktop = useMediaQuery("md");
  const { mutateAsync: updateMemo } = useUpdateMemo();
  const { mutateAsync: deleteMemo } = useDeleteMemo();

  const handleSwipeToggleArchive = useCallback(async () => {
    const isArchiving = !isArchived;
    const state = isArchived ? State.NORMAL : State.ARCHIVED;
    const message = isArchived ? t("message.restored-successfully") : t("message.archived-successfully");
    try {
      await updateMemo({ update: { name: memoData.name, state }, updateMask: ["state"] });
      toast.success(message);
    } catch (error: unknown) {
      handleError(error, toast.error, { context: `${isArchiving ? "Archive" : "Restore"} memo`, fallbackMessage: "An error occurred" });
    }
  }, [isArchived, memoData.name, t, updateMemo]);

  const handleSwipeDelete = useCallback(async () => {
    try {
      await deleteMemo(memoData.name);
      toast.success(t("message.deleted-successfully"));
    } catch (error: unknown) {
      handleError(error, toast.error, { context: "Delete memo", fallbackMessage: "An error occurred" });
    }
  }, [deleteMemo, memoData.name, t]);

  useEffect(() => {
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
  }, []);

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

  if (showEditor) {
    return (
      <MemoEditor
        autoFocus
        className="mb-3"
        cacheKey={`inline-memo-editor-${memoData.name}`}
        memo={memoData}
        parentMemoName={memoData.parent || undefined}
        onConfirm={closeEditor}
        onCancel={closeEditor}
      />
    );
  }

  const swipeEnabled = !isDesktop && !readonly && !isInMemoDetailPage;
  // When swipe is enabled, spacing moves to the wrapper as padding (not margin) so the pinned badge —
  // which pokes a few pixels above the card's top edge — stays inside the wrapper's clipping box and isn't cut off.
  const cardSpacingClassName = showCommentPreview ? "pb-3" : "pt-3 pb-0!";

  const article = (
    <article
      className={cn(
        MEMO_CARD_BASE_CLASSES,
        showCommentPreview ? "rounded-b-none" : "mt-3 mb-0!",
        swipeEnabled && "m-0!",
        showPinned && memoData.pinned && "border-l-2 border-l-primary",
        className,
      )}
      ref={cardRef}
      tabIndex={readonly ? -1 : 0}
    >
      <MemoHeader showCreator={showCreator} showVisibility={showVisibility} showPinned={showPinned} />

      <MemoBody compact={compact} />

      <PreviewImageDialog
        open={previewState.open}
        onOpenChange={setPreviewOpen}
        items={previewState.items}
        initialIndex={previewState.index}
      />

      {props.onShareImageDialogOpenChange && (
        <MemoShareImageDialog open={Boolean(props.shareImageDialogOpen)} onOpenChange={props.onShareImageDialogOpenChange} />
      )}
    </article>
  );

  const swipePrimaryAction = {
    label: isArchived ? t("common.restore") : t("common.archive"),
    icon: isArchived ? <ArchiveRestoreIcon className="w-5 h-5" /> : <ArchiveIcon className="w-5 h-5" />,
    color: "#EF9F27",
    onTrigger: handleSwipeToggleArchive,
  };
  const cardContent = swipeEnabled ? (
    <MemoSwipeActions className={cardSpacingClassName} primaryAction={swipePrimaryAction} onDelete={handleSwipeDelete}>
      {article}
    </MemoSwipeActions>
  ) : (
    article
  );

  return (
    <MemoViewContext.Provider value={contextValue}>
      {showCommentPreview ? (
        <div className="w-full mb-3">
          {cardContent}
          <MemoCommentListView />
        </div>
      ) : (
        cardContent
      )}
    </MemoViewContext.Provider>
  );
};

export default memo(MemoView);
