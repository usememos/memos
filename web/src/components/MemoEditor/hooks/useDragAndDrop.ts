import { useState } from "react";

export function useDragAndDrop(onDrop: (files: FileList) => void) {
  const [isDragging, setIsDragging] = useState(false);

  return {
    isDragging,
    dragHandlers: {
      onDragOver: (e: React.DragEvent) => {
        if (e.dataTransfer?.types.includes("Files")) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          setIsDragging(true);
        }
      },
      onDragLeave: (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
      },
      onDrop: (e: React.DragEvent) => {
        if (e.dataTransfer?.files.length) {
          e.preventDefault();
          setIsDragging(false);
          onDrop(e.dataTransfer.files);
        }
      },
    },
  };
}
