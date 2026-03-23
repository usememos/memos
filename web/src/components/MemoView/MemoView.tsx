import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useImagePreview } from "./hooks";
import { computeCommentAmount, MemoViewContext } from "./MemoViewContext";
import type { MemoViewProps } from "./types";
import MemoFooter from "./components/MemoFooter";

const MemoView: React.FC<MemoViewProps> = (props: MemoViewProps) => {
  const {
    memo: memoData,
    className,
    parentPage: parentPageProp,
    compact,
    showCreator,
    showVisibility,
    showPinned,
    colorKey,
  } = props;
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
  const toggleNsfwVisibility = useCallback(() => setShowNSFWContent((prev) => !prev), []);

  const { previewState, openPreview, setPreviewOpen } = useImagePreview();

  const openEditor = useCallback(() => setShowEditor(true), []);
  const closeEditor = useCallback(() => setShowEditor(false), []);

  const location = useLocation();
  const isInMemoDetailPage = location.pathname.startsWith(`/${memoData.name}`);
  const showCommentPreview = !isInMemoDetailPage && computeCommentAmount(memoData) > 0;

  const [customColors, setCustomColors] = useState<{ bgColor?: string; textColor?: string } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storageKey = colorKey || memoData.name;

    try {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) {
        return;
      }

      const parsed = JSON.parse(stored) as { bgColor?: string; textColor?: string };
      setCustomColors({
        bgColor: parsed.bgColor,
        textColor: parsed.textColor,
      });
    } catch {
      // Ignore malformed values
    }
  }, [colorKey, memoData.name]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storageKey = colorKey || memoData.name;

    const handleColorChange = (event: Event) => {
      const customEvent = event as CustomEvent<{
        key: string;
        colors: { bgColor?: string; textColor?: string };
      }>;

      if (!customEvent.detail || customEvent.detail.key !== storageKey) {
        return;
      }

      setCustomColors({
        bgColor: customEvent.detail.colors.bgColor,
        textColor: customEvent.detail.colors.textColor,
      });
    };

    window.addEventListener("memo-colors-changed", handleColorChange as EventListener);

    return () => {
      window.removeEventListener("memo-colors-changed", handleColorChange as EventListener);
    };
  }, [colorKey, memoData.name]);

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
      openEditor,
      toggleNsfwVisibility,
      openPreview,
    }),
    [
      memoData,
      creator,
      currentUser,
      parentPage,
      isArchived,
      readonly,
      showNSFWContent,
      nsfw,
      openEditor,
      toggleNsfwVisibility,
      openPreview,
    ],
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
      style={
        customColors?.bgColor || customColors?.textColor
          ? { backgroundColor: customColors?.bgColor, color: customColors?.textColor }
          : undefined
      }
    >
      <MemoHeader
        name={memoData.name}
        showCreator={showCreator}
        showVisibility={showVisibility}
        showPinned={showPinned}
        showColorCustomizer={!memoData.parent}
        onColorPreferencesChange={(colors) => setCustomColors(colors)}
      />

      <MemoBody compact={compact} />
      <MemoFooter/>
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
        <div className="w-full mb-2">
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
