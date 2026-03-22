export function useDragAndDrop(onDrop: (files: FileList) => void) {
  return {
    dragHandlers: {
      onDragOver: (e: React.DragEvent) => {
        if (e.dataTransfer?.types.includes("Files")) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }
      },
      onDragLeave: (e: React.DragEvent) => {
        e.preventDefault();
      },
      onDrop: (e: React.DragEvent) => {
        if (e.dataTransfer?.files.length) {
          e.preventDefault();
          onDrop(e.dataTransfer.files);
        }
      },
    },
  };
}
