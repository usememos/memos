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
import { useImagePreview, useMemoActions, useMemoHandlers, useNsfwContent } from "./hooks";
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
  // handle onClick to go to details page
  const handleArticleClick = (e: React.MouseEvent) => {
    if (e.defaultPrevented) {return}; // prevent if other onClick events are triggered first
   let target = e.target as HTMLElement | null;
   // Handle for interactive elements
   if (target && target.closest && target.closest("a, th, td, span, .no-goto")) {
     return;
   }
   let el = target;
  while (el) {
    const cls = el.classList;
     //Handle for img class items inside memo content
    if (cls && cls.contains("grid")&& cls.contains("grid-cols-2")) {
      return;
    }
     // Handle map inside memo content
    if (cls && cls.contains("leaflet-container")) {
      return;
    }
    el = el.parentElement;
  }
  // Handle for menuitems(Pin, Edit, Copy, Archive, Delete), dialog and buttons types
  let role = target?.getAttribute("role");
  let type = target?.getAttribute("type");
  if (role === "menuitem"|| type==="dialog" || type === "button") {
    return;
  }
   handleGotoMemoDetailPage();
 };

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
      <article onClick={handleArticleClick} className={cn(MEMO_CARD_BASE_CLASSES, className)} ref={cardRef} tabIndex={readonly ? -1 : 0}>
        <MemoHeader
          showCreator={props.showCreator}
          showVisibility={props.showVisibility}
          showPinned={props.showPinned}
          onEdit={openEditor}
          onGotoDetail={handleGotoMemoDetailPage}
          onUnpin={unpinMemo}
          onToggleNsfwVisibility={toggleNsfwVisibility}
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
