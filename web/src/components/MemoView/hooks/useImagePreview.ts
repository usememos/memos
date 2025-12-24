import { useState } from "react";

export interface ImagePreviewState {
  open: boolean;
  urls: string[];
  index: number;
}

export interface UseImagePreviewReturn {
  previewState: ImagePreviewState;
  openPreview: (url: string) => void;
  closePreview: () => void;
  setPreviewOpen: (open: boolean) => void;
}

export const useImagePreview = (): UseImagePreviewReturn => {
  const [previewState, setPreviewState] = useState<ImagePreviewState>({ open: false, urls: [], index: 0 });

  return {
    previewState,
    openPreview: (url: string) => setPreviewState({ open: true, urls: [url], index: 0 }),
    closePreview: () => setPreviewState({ open: false, urls: [], index: 0 }),
    setPreviewOpen: (open: boolean) => setPreviewState((prev) => ({ ...prev, open })),
  };
};
