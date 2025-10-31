import { DndContext, closestCenter, MouseSensor, TouchSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { FileIcon, XIcon } from "lucide-react";
import { Attachment } from "@/types/proto/api/v1/attachment_service";
import { getAttachmentThumbnailUrl, getAttachmentType } from "@/utils/attachment";
import SortableItem from "./SortableItem";

interface Props {
  attachmentList: Attachment[];
  setAttachmentList: (attachmentList: Attachment[]) => void;
}

const AttachmentListView = (props: Props) => {
  const { attachmentList, setAttachmentList } = props;
  const sensors = useSensors(useSensor(MouseSensor), useSensor(TouchSensor));

  const handleDeleteAttachment = async (name: string) => {
    setAttachmentList(attachmentList.filter((attachment) => attachment.name !== name));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = attachmentList.findIndex((attachment) => attachment.name === active.id);
      const newIndex = attachmentList.findIndex((attachment) => attachment.name === over.id);

      setAttachmentList(arrayMove(attachmentList, oldIndex, newIndex));
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={attachmentList.map((attachment) => attachment.name)} strategy={verticalListSortingStrategy}>
        {attachmentList.length > 0 && (
          <div className="w-full flex flex-row justify-start flex-wrap gap-2 mt-2 max-h-[50vh] overflow-y-auto">
            {attachmentList.map((attachment) => {
              return (
                <div
                  key={attachment.name}
                  className="group relative inline-flex items-center gap-1.5 px-2 h-7 rounded-md border border-border bg-background text-secondary-foreground text-xs transition-colors hover:bg-accent"
                >
                  <SortableItem id={attachment.name} className="flex items-center gap-1.5 min-w-0">
                    {getAttachmentType(attachment) === "image/*" ? (
                      <img
                        src={getAttachmentThumbnailUrl(attachment)}
                        alt={attachment.filename}
                        className="w-5 h-5 shrink-0 object-cover rounded"
                      />
                    ) : (
                      <FileIcon className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate max-w-[160px]">{attachment.filename}</span>
                  </SortableItem>
                  <button
                    className="shrink-0 rounded hover:bg-accent transition-colors p-0.5"
                    onClick={() => handleDeleteAttachment(attachment.name)}
                  >
                    <XIcon className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </SortableContext>
    </DndContext>
  );
};

export default AttachmentListView;
