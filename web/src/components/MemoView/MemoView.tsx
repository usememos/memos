import { PinIcon } from "lucide-react";
import { type ComponentType, memo, Suspense, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useResolvedUser } from "@/components/MemoContent/MentionResolutionContext";
import { loadMemoEditor } from "@/components/MemoEditor/loader";
import type { MemoEditorProps } from "@/components/MemoEditor/types";
import { useAuth } from "@/contexts/AuthContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import useNavigateTo from "@/hooks/useNavigateTo";
import { findTagMetadata } from "@/lib/tag";
import { cn } from "@/lib/utils";
import { State } from "@/types/proto/api/v1/common_pb";
import { useTranslate } from "@/utils/i18n";
import { lazyWithReload } from "@/utils/lazy";
import { isSuperUser } from "@/utils/user";
import { getBentoCoverUrl, getBentoTileTitle } from "./bentoCover";
import { MemoBody, MemoCommentListView, MemoHeader } from "./components";
import { MEMO_CARD_BASE_CLASSES } from "./constants";
import { useImagePreview } from "./hooks";
import { computeCommentAmount, MemoViewContext } from "./MemoViewContext";
import { createMemoNavigationState, isMemoDetailPath, resolveMemoOrigin } from "./navigation";
import type { MemoViewProps } from "./types";

const MemoShareImageDialog = lazyWithReload(() => import("../MemoActionMenu/MemoShareImageDialog"));
const PreviewImageDialog = lazyWithReload(() => import("../PreviewImageDialog"));

const MemoView: React.FC<MemoViewProps> = (props: MemoViewProps) => {
  const {
    memo: memoData,
    className,
    parentPage: parentPageProp,
    parentScope: parentScopeProp,
    compact,
    variant = "card",
    showCreator,
    showVisibility,
    showPinned,
    showSpace,
  } = props;
  const cardRef = useRef<HTMLDivElement>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [EditorComponent, setEditorComponent] = useState<ComponentType<MemoEditorProps>>();
  const [cardWidth, setCardWidth] = useState(0);
  const [failedBentoCover, setFailedBentoCover] = useState<string>();
  const t = useTranslate();

  const currentUser = useCurrentUser();
  const { userTagsSetting } = useAuth();
  const creator = useResolvedUser(memoData.creator, { enabled: Boolean(showCreator || props.shareImageDialogOpen) });
  const isArchived = memoData.state === State.ARCHIVED;
  const readonly = memoData.creator !== currentUser?.name && !isSuperUser(currentUser);
  const location = useLocation();
  const navigateTo = useNavigateTo();
  const { parentPage, parentScope } = resolveMemoOrigin({
    explicitParentPage: parentPageProp,
    explicitParentScope: parentScopeProp,
    pathname: location.pathname,
    search: location.search,
    memoName: memoData.name,
  });

  // Blur content when any tag has blur_content enabled in the current user's tag settings.
  const [showBlurredContent, setShowBlurredContent] = useState(false);
  const blurred = memoData.tags?.some((tag) => userTagsSetting && findTagMetadata(tag, userTagsSetting)?.blurContent) ?? false;
  const toggleBlurVisibility = useCallback(() => setShowBlurredContent((prev) => !prev), []);

  const { previewState, openPreview, setPreviewOpen } = useImagePreview();

  const openEditor = useCallback(() => {
    void loadMemoEditor()
      .then(({ default: MemoEditor }) => {
        setEditorComponent(() => MemoEditor);
        setShowEditor(true);
      })
      .catch(() => undefined);
  }, []);
  const closeEditor = useCallback(() => setShowEditor(false), []);

  const isInMemoDetailPage = isMemoDetailPath(location.pathname, memoData.name);
  const showCommentPreview = variant !== "bento" && !isInMemoDetailPage && computeCommentAmount(memoData) > 0;
  const bentoCover = variant === "bento" ? getBentoCoverUrl(memoData) : undefined;
  const visibleBentoCover = bentoCover === failedBentoCover ? undefined : bentoCover;
  const bentoTileTitle = variant === "bento" ? getBentoTileTitle(memoData) : "";
  const bentoTitle = bentoTileTitle || memoData.name.split("/").pop() || memoData.name;

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
      parentScope,
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
      parentScope,
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
      className={cn(
        MEMO_CARD_BASE_CLASSES,
        showCommentPreview ? "mb-0 rounded-b-none" : "mb-2",
        variant === "bento" && "justify-end p-0",
        className,
      )}
      ref={cardRef}
      tabIndex={variant === "bento" ? -1 : readonly ? -1 : 0}
    >
      {variant === "bento" ? (
        <>
          {visibleBentoCover && (
            <div aria-hidden className="absolute inset-0">
              <img
                src={visibleBentoCover}
                alt=""
                loading="lazy"
                className="size-full object-cover"
                onError={() => setFailedBentoCover(visibleBentoCover)}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />
            </div>
          )}
          {showPinned && memoData.pinned && (
            <div className="absolute right-2 top-2 z-20 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
              <PinIcon className="size-3" strokeWidth={2} />
              {t("common.pinned")}
            </div>
          )}
          {/* Cover tiles trade the full card body for a glanceable title overlay; the
              action menu and full content stay one click away on the detail page. */}
          <button
            type="button"
            className={cn("relative z-10 mt-auto w-full cursor-pointer p-3 text-left", visibleBentoCover && "pt-10")}
            onClick={() => navigateTo(`/${memoData.name}`, { state: createMemoNavigationState(parentPage, parentScope) })}
          >
            <p className={cn("line-clamp-3 text-sm font-medium", visibleBentoCover && "text-white drop-shadow-sm")}>{bentoTitle}</p>
            <p className={cn("mt-1 line-clamp-1 text-xs text-muted-foreground", visibleBentoCover && "text-white/75")}>
              {creator && `${creator.displayName || creator.username} · `}
              {memoData.name.split("/").pop()}
            </p>
          </button>
        </>
      ) : (
        <>
          <MemoHeader showCreator={showCreator} showVisibility={showVisibility} showPinned={showPinned} showSpace={showSpace} />

          <MemoBody compact={compact} />
        </>
      )}

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
        <EditorComponent
          autoFocus
          className="mb-2"
          cacheKey={`inline-memo-editor-${memoData.name}`}
          memo={memoData}
          parentMemoName={memoData.parent || undefined}
          onConfirm={closeEditor}
          onCancel={closeEditor}
        />
      ) : (
        memoDisplay
      )}
    </MemoViewContext.Provider>
  );
};

export default memo(MemoView);
