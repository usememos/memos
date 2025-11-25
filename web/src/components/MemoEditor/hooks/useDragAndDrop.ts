import { useState } from "react";

interface UseDragAndDropOptions {
  onDrop: (files: FileList) => void;
}

/**
 * Custom hook for handling drag-and-drop file uploads
 * Manages drag state and event handlers
 *
 * @param options - Configuration options
 * @returns Drag state and event handlers
 *
 * @example
 * ```tsx
 * const { isDragging, dragHandlers } = useDragAndDrop({
 *   onDrop: (files) => handleFiles(files),
 * });
 *
 * <div {...dragHandlers} className={isDragging ? 'border-dashed' : ''}>
 *   Drop files here
 * </div>
 * ```
 */
export function useDragAndDrop({ onDrop }: UseDragAndDropOptions) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (event: React.DragEvent): void => {
    if (event.dataTransfer && event.dataTransfer.types.includes("Files")) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      if (!isDragging) {
        setIsDragging(true);
      }
    }
  };

  const handleDragLeave = (event: React.DragEvent): void => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent): void => {
    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      event.preventDefault();
      setIsDragging(false);
      onDrop(event.dataTransfer.files);
    }
  };

  return {
    isDragging,
    dragHandlers: {
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
    },
  };
}
