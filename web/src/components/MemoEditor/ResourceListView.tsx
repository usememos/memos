import { DndContext, closestCenter, MouseSensor, TouchSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { XIcon } from "lucide-react";
import { Resource } from "@/types/proto/api/v1/resource_service";
import { useTranslate } from "@/utils/i18n";
import { getResourceUrl } from "@/utils/resource";
import ResourceIcon from "../ResourceIcon";
import SortableItem from "./SortableItem";

interface Props {
  resourceList: Resource[];
  setResourceList: (resourceList: Resource[]) => void;
  checkIfSafeToDeleteResource?: (resource: Resource) => boolean;
}

const ResourceListView = (props: Props) => {
  const { resourceList, setResourceList, checkIfSafeToDeleteResource } = props;
  const sensors = useSensors(useSensor(MouseSensor), useSensor(TouchSensor));
  const t = useTranslate();

  const handleDeleteResource = async (name: string) => {
    if (
      typeof checkIfSafeToDeleteResource === "function" &&
      !checkIfSafeToDeleteResource(resourceList.find((resource) => resource.name === name)!)
    ) {
      const confirmationText = t("resource.delete-confirm-referenced");
      if (!window.confirm(confirmationText)) return;
    }
    setResourceList(resourceList.filter((resource) => resource.name !== name));
  };

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
          <div className="w-full flex flex-row justify-start flex-wrap gap-2 mt-2 max-h-[50vh] overflow-y-auto">
            {resourceList.map((resource) => {
              return (
                <div
                  key={resource.name}
                  className="max-w-full w-auto flex flex-row justify-start items-center flex-nowrap gap-x-1 bg-zinc-100 dark:bg-zinc-900 px-2 py-1 rounded hover:shadow-sm text-gray-500 dark:text-gray-400"
                >
                  <SortableItem id={resource.name} className="flex flex-row justify-start items-center gap-x-1">
                    <ResourceIcon resource={resource} className="!w-4 !h-4 !opacity-100" />
                    <a
                      className="text-sm max-w-[8rem] truncate"
                      href={getResourceUrl(resource)}
                      target="_blank"
                      onPointerDown={preventLinkOpen}
                    >
                      {resource.filename}
                    </a>
                  </SortableItem>
                  <button className="shrink-0" onClick={() => handleDeleteResource(resource.name)}>
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

const preventLinkOpen: React.PointerEventHandler = (e) => {
  if (e.pointerType === "mouse" && (e.button !== 0 || e.metaKey || e.ctrlKey)) return;

  const pointerId = e.pointerId;
  const target = e.currentTarget;
  const href = target.getAttribute("href");
  if (!href) return;

  function reset(ev: PointerEvent) {
    if (ev.pointerId !== pointerId) return;

    ev.preventDefault();
    setTimeout(() => target.setAttribute("href", href!), 100);
    window.removeEventListener("pointerup", reset, true);
    window.removeEventListener("pointercancel", reset, true);
  }
  target.removeAttribute("href");
  window.addEventListener("pointerup", reset, true);
  window.addEventListener("pointercancel", reset, true);
};

export default ResourceListView;
