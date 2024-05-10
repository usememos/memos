import { DndContext, closestCenter, MouseSensor, TouchSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Resource } from "@/types/proto/api/v1/resource_service";
import Icon from "../Icon";
import SortableItem from "./SortableItem";

interface Props {
  resourceList: Resource[];
  setResourceList: (resourceList: Resource[]) => void;
}

const ResourceListView = (props: Props) => {
  const { resourceList, setResourceList } = props;

  const sensors = useSensors(useSensor(MouseSensor), useSensor(TouchSensor));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = resourceList.findIndex((resource) => resource.name === active.id);
      const newIndex = resourceList.findIndex((resource) => resource.name === over.id);

      setResourceList(arrayMove(resourceList, oldIndex, newIndex));
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={resourceList.map((resource) => resource.name)} strategy={verticalListSortingStrategy}>
        {resourceList.length > 0 && (
          <div className="w-full flex flex-row justify-start flex-wrap gap-2 mt-2">
            {resourceList.map((resource) => {
              return (
                <SortableItem
                  key={resource.name}
                  id={resource.name}
                  className="max-w-full flex flex-row justify-start items-center flex-nowrap gap-x-1 bg-zinc-100 dark:bg-zinc-900 px-2 py-1 rounded text-gray-500 dark:text-gray-400"
                >
                  <Icon.File className="w-4 h-auto" />
                  <span className="text-sm max-w-[8rem] truncate">{resource.filename}</span>
                </SortableItem>
              );
            })}
          </div>
        )}
      </SortableContext>
    </DndContext>
  );
};

export default ResourceListView;
