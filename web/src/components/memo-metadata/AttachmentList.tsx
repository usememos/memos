import { closestCenter, DndContext, DragEndEvent, MouseSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useState } from "react";
import { Attachment } from "@/types/proto/api/v1/attachment_service";
import { getAttachmentType, getAttachmentUrl } from "@/utils/attachment";
import MemoAttachment from "../MemoAttachment";
import SortableItem from "../MemoEditor/SortableItem";
import PreviewImageDialog from "../PreviewImageDialog";
import AttachmentCard from "./AttachmentCard";
import { BaseMetadataProps } from "./types";

interface AttachmentListProps extends BaseMetadataProps {
  attachments: Attachment[];
  onAttachmentsChange?: (attachments: Attachment[]) => void;
}

/**
 * Unified AttachmentList component for both editor and view modes
 *
 * Editor mode:
 * - Shows all attachments as sortable badges with thumbnails
 * - Supports drag-and-drop reordering
 * - Shows remove buttons
 *
 * View mode:
 * - Separates media (images/videos) from other files
 * - Shows media in gallery layout with preview
 * - Shows other files as clickable cards
 */
const AttachmentList = ({ attachments, mode, onAttachmentsChange }: AttachmentListProps) => {
  const sensors = useSensors(useSensor(MouseSensor), useSensor(TouchSensor));
  const [previewImage, setPreviewImage] = useState<{ open: boolean; urls: string[]; index: number }>({
    open: false,
    urls: [],
    index: 0,
  });

  const handleDeleteAttachment = (name: string) => {
    if (onAttachmentsChange) {
      onAttachmentsChange(attachments.filter((attachment) => attachment.name !== name));
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && onAttachmentsChange) {
      const oldIndex = attachments.findIndex((attachment) => attachment.name === active.id);
      const newIndex = attachments.findIndex((attachment) => attachment.name === over.id);
      onAttachmentsChange(arrayMove(attachments, oldIndex, newIndex));
    }
  };

  const handleImageClick = (imgUrl: string, mediaAttachments: Attachment[]) => {
    const imgUrls = mediaAttachments
      .filter((attachment) => getAttachmentType(attachment) === "image/*")
      .map((attachment) => getAttachmentUrl(attachment));
    const index = imgUrls.findIndex((url) => url === imgUrl);
    setPreviewImage({ open: true, urls: imgUrls, index });
  };

  // Editor mode: Show all attachments as sortable badges
  if (mode === "edit") {
    if (attachments.length === 0) {
      return null;
    }

    return (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={attachments.map((attachment) => attachment.name)} strategy={verticalListSortingStrategy}>
          <div className="w-full flex flex-row justify-start flex-wrap gap-2 mt-2 max-h-[50vh] overflow-y-auto">
            {attachments.map((attachment) => (
              <div key={attachment.name}>
                <SortableItem id={attachment.name} className="flex items-center gap-1.5 min-w-0">
                  <AttachmentCard
                    attachment={attachment}
                    mode="edit"
                    onRemove={() => handleDeleteAttachment(attachment.name)}
                    showThumbnail={true}
                  />
                </SortableItem>
              </div>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    );
  }

  // View mode: Separate media from other files
  const mediaAttachments: Attachment[] = [];
  const otherAttachments: Attachment[] = [];

  attachments.forEach((attachment) => {
    const type = getAttachmentType(attachment);
    if (type === "image/*" || type === "video/*") {
      mediaAttachments.push(attachment);
    } else {
      otherAttachments.push(attachment);
    }
  });

  return (
    <>
      {/* Media Gallery */}
      {mediaAttachments.length > 0 && (
        <div className="w-full flex flex-row justify-start overflow-auto gap-2">
          {mediaAttachments.map((attachment) => (
            <div key={attachment.name} className="max-w-[60%] w-fit flex flex-col justify-start items-start shrink-0">
              <AttachmentCard
                attachment={attachment}
                mode="view"
                onClick={() => {
                  const attachmentUrl = getAttachmentUrl(attachment);
                  handleImageClick(attachmentUrl, mediaAttachments);
                }}
                className="max-h-64 grow"
              />
            </div>
          ))}
        </div>
      )}

      {/* Other Files */}
      {otherAttachments.length > 0 && (
        <div className="w-full flex flex-row justify-start overflow-auto gap-2">
          {otherAttachments.map((attachment) => (
            <MemoAttachment key={attachment.name} attachment={attachment} />
          ))}
        </div>
      )}

      {/* Image Preview Dialog */}
      <PreviewImageDialog
        open={previewImage.open}
        onOpenChange={(open) => setPreviewImage((prev) => ({ ...prev, open }))}
        imgUrls={previewImage.urls}
        initialIndex={previewImage.index}
      />
    </>
  );
};

export default AttachmentList;
