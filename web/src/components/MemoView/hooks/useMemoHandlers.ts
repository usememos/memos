import { useCallback } from "react";
import { useInstance } from "@/contexts/InstanceContext";

interface UseMemoHandlersOptions {
  readonly: boolean;
  openEditor: () => void;
  openPreview: (urls: string | string[], index?: number) => void;
}

export const useMemoHandlers = (options: UseMemoHandlersOptions) => {
  const { readonly, openEditor, openPreview } = options;
  const { memoRelatedSetting } = useInstance();

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
      if (memoRelatedSetting.enableDoubleClickEdit) {
        e.preventDefault();
        openEditor();
      }
    },
    [readonly, openEditor, memoRelatedSetting.enableDoubleClickEdit],
  );

  return { handleMemoContentClick, handleMemoContentDoubleClick };
};
