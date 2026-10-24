import { useCallback } from "react";
import { useDevicePreferences } from "@/hooks/useDevicePreferences";
import type { PreviewMediaItem } from "@/utils/media-item";

interface UseMemoHandlersOptions {
  readonly: boolean;
  openEditor: () => void;
  openPreview: (items: string | string[] | PreviewMediaItem[], index?: number) => void;
}

export const useMemoHandlers = (options: UseMemoHandlersOptions) => {
  const { readonly, openEditor, openPreview } = options;
  const { doubleClickEdit } = useDevicePreferences();

  const handleMemoContentClick = useCallback(
    (e: React.MouseEvent) => {
      const targetEl = e.target as HTMLElement;
      if (targetEl.tagName === "IMG") {
        const linkElement = targetEl.closest("a");
        if (linkElement) return; // If image is inside a link, don't show preview
        const imgUrl = targetEl.getAttribute("src");
        if (imgUrl) openPreview(imgUrl);
      }
    },
    [openPreview],
  );

  const handleMemoContentDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (readonly) return;
      if (doubleClickEdit) {
        e.preventDefault();
        openEditor();
      }
    },
    [readonly, openEditor, doubleClickEdit],
  );

  return { handleMemoContentClick, handleMemoContentDoubleClick };
};
