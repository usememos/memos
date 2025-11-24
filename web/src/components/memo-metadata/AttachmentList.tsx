import { closestCenter, DndContext, type DragEndEvent, MouseSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useState } from "react";
import type { Attachment } from "@/types/proto/api/v1/attachment_service";
import { getAttachmentType, getAttachmentUrl } from "@/utils/attachment";
import MemoAttachment from "../MemoAttachment";
import SortableItem from "../MemoEditor/SortableItem";
import PreviewImageDialog from "../PreviewImageDialog";
import AttachmentCard from "./AttachmentCard";
import type { AttachmentItem, BaseMetadataProps, LocalFile } from "./types";
import { separateMediaAndDocs, toAttachmentItems } from "./types";

interface AttachmentListProps extends BaseMetadataProps {
  attachments: Attachment[];
  onAttachmentsChange?: (attachments: Attachment[]) => void;
  localFiles?: LocalFile[];
  onRemoveLocalFile?: (previewUrl: string) => void;
}

/**
 * Unified AttachmentList component for both editor and view modes
 *
 * Editor mode:
 * - Shows all attachments as sortable badges with thumbnails
 * - Supports drag-and-drop reordering
 * - Shows remove buttons
 * - Shows pending files (not yet uploaded) with preview
 *
 * View mode:
 * - Separates media (images/videos) from other files
 * - Shows media in gallery layout with preview
 * - Shows other files as clickable cards
 */
const AttachmentList = ({ attachments, mode, onAttachmentsChange, localFiles = [], onRemoveLocalFile }: AttachmentListProps) => {
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

  // Editor mode: Display all items as compact badges with drag-and-drop
  if (mode === "edit") {
    if (attachments.length === 0 && localFiles.length === 0) {
      return null;
    }

    const items = toAttachmentItems(attachments, localFiles);
    // Only uploaded attachments support reordering (stable server IDs)
    const sortableIds = attachments.map((a) => a.name);

    const handleRemoveItem = (item: AttachmentItem) => {
      if (item.isLocal) {
        onRemoveLocalFile?.(item.id);
      } else {
        handleDeleteAttachment(item.id);
      }
    };

    return (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          <div className="w-full flex flex-row justify-start flex-wrap gap-2 mt-2 max-h-[50vh] overflow-y-auto">
            {items.map((item) => (
              <div key={item.id}>
                {/* Uploaded items are wrapped in SortableItem for drag-and-drop */}
                {!item.isLocal ? (
                  <SortableItem id={item.id} className="flex items-center gap-1.5 min-w-0">
                    <AttachmentCard item={item} mode="edit" onRemove={() => handleRemoveItem(item)} showThumbnail />
                  </SortableItem>
                ) : (
                  /* Local items render directly without sorting capability */
                  <div className="flex items-center gap-1.5 min-w-0">
                    <AttachmentCard item={item} mode="edit" onRemove={() => handleRemoveItem(item)} showThumbnail />
                  </div>
                )}
              </div>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    );
  }

  // View mode: Split items into media gallery and document list
  const items = toAttachmentItems(attachments, []);
  const { media: mediaItems, docs: docItems } = separateMediaAndDocs(items);

  return (
    <>
      {/* Media Gallery */}
      {mediaItems.length > 0 && (
        <div className="w-full flex flex-row justify-start overflow-auto gap-2">
          {mediaItems.map((item) => (
            <div key={item.id} className="max-w-[60%] w-fit flex flex-col justify-start items-start shrink-0">
              <AttachmentCard
                item={item}
                mode="view"
                onClick={() => {
                  handleImageClick(item.sourceUrl, attachments);
                }}
                className="max-h-64 grow"
              />
            </div>
          ))}
        </div>
      )}

      {/* Document Files */}
      {docItems.length > 0 && (
        <div className="w-full flex flex-row justify-start overflow-auto gap-2">
          {docItems.map((item) => {
            // Find original attachment for MemoAttachment component
            const attachment = attachments.find((a) => a.name === item.id);
            return attachment ? <MemoAttachment key={item.id} attachment={attachment} /> : null;
          })}
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
