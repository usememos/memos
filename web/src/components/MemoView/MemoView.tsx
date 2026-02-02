import { memo, useMemo, useRef, useState } from "react";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useUser } from "@/hooks/useUserQueries";
import { cn } from "@/lib/utils";
import { State } from "@/types/proto/api/v1/common_pb";
import { isSuperUser } from "@/utils/user";
import MemoEditor from "../MemoEditor";
import PreviewImageDialog from "../PreviewImageDialog";
import { MemoBody, MemoHeader } from "./components";
import { MEMO_CARD_BASE_CLASSES } from "./constants";
import { useImagePreview, useMemoActions, useMemoHandlers } from "./hooks";
import { MemoViewContext } from "./MemoViewContext";
import type { MemoViewProps } from "./types";

const MemoView: React.FC<MemoViewProps> = (props: MemoViewProps) => {
  const { memo: memoData, className, parentPage: parentPageProp } = props;
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
