import { useCallback, useState } from "react";

export interface ImagePreviewState {
  open: boolean;
  urls: string[];
  index: number;
}

export interface UseImagePreviewReturn {
  previewState: ImagePreviewState;
  openPreview: (urls: string | string[], index?: number) => void;
  setPreviewOpen: (open: boolean) => void;
}

export const useImagePreview = (): UseImagePreviewReturn => {
  const [previewState, setPreviewState] = useState<ImagePreviewState>({ open: false, urls: [], index: 0 });

  const openPreview = useCallback((urls: string | string[], index = 0) => {
    setPreviewState({ open: true, urls: Array.isArray(urls) ? urls : [urls], index });
  }, []);

  const setPreviewOpen = useCallback((open: boolean) => {
    setPreviewState((prev) => ({ ...prev, open }));
  }, []);

  return { previewState, openPreview, setPreviewOpen };
};
