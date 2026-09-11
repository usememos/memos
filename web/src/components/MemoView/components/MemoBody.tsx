import { EyeIcon } from "lucide-react";
import { useMemo } from "react";
import ClampedSection from "@/components/ClampedSection";
import { AttachmentGallery, MemoMetadataRows } from "@/components/MemoMetadata";
import { separateAttachments } from "@/components/MemoMetadata/Attachment/attachmentHelpers";
import { isReferenceRelation } from "@/components/MemoMetadata/Relation/relationHelpers";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { filterInlineManagedAttachments } from "@/utils/managed-attachment";
import MemoContent from "../../MemoContent";
import { MemoReactionListView } from "../../MemoReactionListView";
import { useMemoHandlers } from "../hooks";
import { useMemoViewContext } from "../MemoViewContext";
import type { MemoBodyProps } from "../types";

const BlurOverlay: React.FC<{ onClick?: () => void }> = ({ onClick }) => {
  const t = useTranslate();
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center pt-4">
      <Button type="button" variant="outline" size="sm" onClick={onClick}>
        <EyeIcon className="size-3.5" strokeWidth={1.8} />
        {t("memo.click-to-show-sensitive-content")}
      </Button>
    </div>
  );
};

const MemoBody: React.FC<MemoBodyProps> = ({ compact }) => {
  const { memo, parentPage, showBlurredContent, blurred, readonly, openEditor, openPreview, toggleBlurVisibility } = useMemoViewContext();

  const { handleMemoContentClick, handleMemoContentDoubleClick } = useMemoHandlers({ readonly, openEditor, openPreview });

  const referencedMemos = memo.relations.filter(isReferenceRelation);
  // Memoized so AttachmentListView's own useMemo chain keeps its cache across body renders.
  const attachmentOnlyItems = useMemo(
    () => filterInlineManagedAttachments(memo.content, memo.attachments),
    [memo.content, memo.attachments],
  );
  const { visual, audio, docs } = useMemo(() => separateAttachments(attachmentOnlyItems), [attachmentOnlyItems]);

  return (
    <>
      <div
        className={cn(
          "w-full flex flex-col justify-start items-start gap-2",
          blurred && !showBlurredContent && "blur-lg transition-all duration-200",
        )}
      >
        {/* Compact bounds the whole body — attachments included — behind one Show more.
            Reactions stay outside so they never hide under the fade. */}
        <ClampedSection enabled={Boolean(compact)}>
          <MemoContent
            memoName={memo.name}
            parentPage={parentPage}
            content={memo.content}
            attachments={memo.attachments}
            onClick={handleMemoContentClick}
            onDoubleClick={handleMemoContentDoubleClick}
            compact={Boolean(compact)}
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
        <MemoReactionListView memo={memo} reactions={memo.reactions} />
      </div>

      {blurred && !showBlurredContent && <BlurOverlay onClick={toggleBlurVisibility} />}
    </>
  );
};

export default MemoBody;
