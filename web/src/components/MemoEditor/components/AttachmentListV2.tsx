import { PaperclipIcon } from "lucide-react";
import type { FC } from "react";
import type { LocalFile } from "@/components/memo-metadata/types";
import { toAttachmentItems } from "@/components/memo-metadata/types";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import AttachmentItemCard from "./AttachmentItemCard";

interface AttachmentListV2Props {
  attachments: Attachment[];
  localFiles?: LocalFile[];
  onAttachmentsChange?: (attachments: Attachment[]) => void;
  onRemoveLocalFile?: (previewUrl: string) => void;
}

const AttachmentListV2: FC<AttachmentListV2Props> = ({ attachments, localFiles = [], onAttachmentsChange, onRemoveLocalFile }) => {
  if (attachments.length === 0 && localFiles.length === 0) {
    return null;
  }

  const items = toAttachmentItems(attachments, localFiles);

  const handleMoveUp = (index: number) => {
    if (index === 0 || !onAttachmentsChange) return;

    const newAttachments = [...attachments];
    [newAttachments[index - 1], newAttachments[index]] = [newAttachments[index], newAttachments[index - 1]];
    onAttachmentsChange(newAttachments);
  };

  const handleMoveDown = (index: number) => {
    if (index === attachments.length - 1 || !onAttachmentsChange) return;

    const newAttachments = [...attachments];
    [newAttachments[index], newAttachments[index + 1]] = [newAttachments[index + 1], newAttachments[index]];
    onAttachmentsChange(newAttachments);
  };

  const handleRemoveAttachment = (name: string) => {
    if (onAttachmentsChange) {
      onAttachmentsChange(attachments.filter((attachment) => attachment.name !== name));
    }
  };

  const handleRemoveItem = (item: (typeof items)[0]) => {
    if (item.isLocal) {
      onRemoveLocalFile?.(item.id);
    } else {
      handleRemoveAttachment(item.id);
    }
  };

  return (
    <div className="w-full rounded-lg border border-border bg-muted/20 overflow-hidden">
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border bg-muted/30">
        <PaperclipIcon className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Attachments ({items.length})</span>
      </div>

      <div className="p-1 sm:p-1.5 flex flex-col gap-0.5">
        {items.map((item) => {
          const isLocalFile = item.isLocal;
          const attachmentIndex = isLocalFile ? -1 : attachments.findIndex((a) => a.name === item.id);

          return (
            <AttachmentItemCard
              key={item.id}
              item={item}
              onRemove={() => handleRemoveItem(item)}
              onMoveUp={!isLocalFile ? () => handleMoveUp(attachmentIndex) : undefined}
              onMoveDown={!isLocalFile ? () => handleMoveDown(attachmentIndex) : undefined}
              canMoveUp={!isLocalFile && attachmentIndex > 0}
              canMoveDown={!isLocalFile && attachmentIndex < attachments.length - 1}
            />
          );
        })}
      </div>
    </div>
  );
};

export default AttachmentListV2;
