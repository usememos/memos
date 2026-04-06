import { useCallback, useState } from "react";
import type { PreviewMediaItem } from "@/utils/media-item";

export interface ImagePreviewState {
  open: boolean;
  items: PreviewMediaItem[];
  index: number;
}

export interface UseImagePreviewReturn {
  previewState: ImagePreviewState;
  openPreview: (items: string | string[] | PreviewMediaItem[], index?: number) => void;
  setPreviewOpen: (open: boolean) => void;
}

export const useImagePreview = (): UseImagePreviewReturn => {
  const [previewState, setPreviewState] = useState<ImagePreviewState>({ open: false, items: [], index: 0 });

  const openPreview = useCallback((items: string | string[] | PreviewMediaItem[], index = 0) => {
    const normalizedItems = normalizePreviewItems(items);
    setPreviewState({ open: true, items: normalizedItems, index });
  }, []);

  const setPreviewOpen = useCallback((open: boolean) => {
    setPreviewState((prev) => ({ ...prev, open }));
  }, []);

  return { previewState, openPreview, setPreviewOpen };
};

function normalizePreviewItems(items: string | string[] | PreviewMediaItem[]): PreviewMediaItem[] {
  if (typeof items === "string") {
    return [
      {
        id: items,
        kind: "image",
        sourceUrl: items,
        posterUrl: items,
        filename: "Image",
      },
    ];
  }

  if (Array.isArray(items) && (items.length === 0 || typeof items[0] === "string")) {
    return (items as string[]).map((url) => ({
      id: url,
      kind: "image",
      sourceUrl: url,
      posterUrl: url,
      filename: "Image",
    }));
  }

  return items as PreviewMediaItem[];
}
