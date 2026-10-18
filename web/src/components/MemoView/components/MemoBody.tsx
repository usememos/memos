import { EyeIcon } from "lucide-react";
import { useMemo } from "react";
import ClampedSection from "@/components/ClampedSection";
import { MemoEditor } from "@/components/MemoEditor/MemoEditor";
import { AttachmentGallery, MemoMetadataRows } from "@/components/MemoMetadata";
import { separateAttachments } from "@/components/MemoMetadata/Attachment/attachmentHelpers";
import { isReferenceRelation } from "@/components/MemoMetadata/Relation/relationHelpers";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { filterInlineManagedAttachments } from "@/utils/managed-attachment";
import { MemoReactionListView } from "../../MemoReactionListView";
import { useMemoHandlers } from "../hooks";
import { useMemoViewContext } from "../MemoViewContext";
import type { MemoBodyProps } from "../types";

const BlurOverlay: React.FC<{ onClick?: () => void }> = ({ onClick }) => {
  const t = useTranslate();
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center">
      <Button type="button" variant="outline" size="sm" onClick={onClick}>
        <EyeIcon className="size-3.5" strokeWidth={1.8} />
        {t("memo.click-to-show-sensitive-content")}
      </Button>
    </div>
  );
};

const MemoBody: React.FC<MemoBodyProps> = ({ compact }) => {
  const {
    memo,
    parentPage,
    showBlurredContent,
    blurred,
    readonly,
    isEditing,
    openEditor,
    closeEditor,
    onEditorFocusModeChange,
    openPreview,
    toggleBlurVisibility,
  } = useMemoViewContext();

  const { handleMemoContentClick, handleMemoContentDoubleClick } = useMemoHandlers({ readonly, openEditor, openPreview });

  const referencedMemos = memo.relations.filter(isReferenceRelation);
  // Memoized so AttachmentListView's own useMemo chain keeps its cache across body renders.
  const attachmentOnlyItems = useMemo(
    () => filterInlineManagedAttachments(memo.content, memo.attachments),
    [memo.content, memo.attachments],
  );
  const { visual, audio, docs } = useMemo(() => separateAttachments(attachmentOnlyItems), [attachmentOnlyItems]);

  // Editing takes the body's place inside the card's own frame: the session brings its
  // attachments, metadata and toolbar, so the read-only rows and reactions step aside.
  if (isEditing) {
    return (
      <div data-slot="memo-body" className="w-full">
        <MemoEditor
          mode="edit"
          name={memo.name}
          frameless
          autoFocus
          onConfirm={closeEditor}
          onCancel={closeEditor}
          onFocusModeChange={onEditorFocusModeChange}
        />
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col justify-start items-start gap-2">
      <div data-slot="memo-body" className="relative w-full">
        <div
          className={cn(
            "w-full flex flex-col justify-start items-start gap-2",
            blurred && !showBlurredContent && "blur-lg transition-all duration-200",
          )}
        >
          {/* Compact bounds the whole body — attachments included — behind one Show more.
              Reactions stay outside so they never hide under the fade. */}
          <ClampedSection enabled={Boolean(compact)}>
            <MemoEditor
              name={memo.name}
              parentPage={parentPage}
              compact={Boolean(compact)}
              onClick={handleMemoContentClick}
              onDoubleClick={handleMemoContentDoubleClick}
            />
            <AttachmentGallery visual={visual} onImagePreview={openPreview} />
            <MemoMetadataRows
              audio={audio}
              docs={docs}
              relations={referencedMemos}
              currentMemoName={memo.name}
              parentPage={parentPage}
              location={memo.location}
            />
          </ClampedSection>
        </div>

        {blurred && !showBlurredContent && <BlurOverlay onClick={toggleBlurVisibility} />}
      </div>

      <MemoReactionListView memo={memo} reactions={memo.reactions} />
    </div>
  );
};

export default MemoBody;
