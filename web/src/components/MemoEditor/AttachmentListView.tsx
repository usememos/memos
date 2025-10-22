import { DndContext, closestCenter, MouseSensor, TouchSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { XIcon } from "lucide-react";
import { Attachment } from "@/types/proto/api/v1/attachment_service";
import AttachmentIcon from "../AttachmentIcon";
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
                  className="max-w-full w-auto flex flex-row justify-start items-center flex-nowrap gap-x-1 bg-muted px-2 py-1 rounded hover:shadow-sm text-muted-foreground"
                >
                  <SortableItem id={attachment.name} className="flex flex-row justify-start items-center gap-x-1">
                    <AttachmentIcon attachment={attachment} className="w-4! h-4! opacity-100!" />
                    <span className="text-sm max-w-32 truncate">{attachment.filename}</span>
                  </SortableItem>
                  <button className="shrink-0" onClick={() => handleDeleteAttachment(attachment.name)}>
                    <XIcon className="w-4 h-auto cursor-pointer opacity-60 hover:opacity-100" />
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
