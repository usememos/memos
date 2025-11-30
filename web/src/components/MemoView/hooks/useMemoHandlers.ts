import { useCallback } from "react";
import useNavigateTo from "@/hooks/useNavigateTo";
import { instanceStore } from "@/store";
import type { UseImagePreviewReturn } from "../types";

export interface UseMemoHandlersOptions {
  memoName: string;
  parentPage: string;
  readonly: boolean;
  openEditor: () => void;
  openPreview: UseImagePreviewReturn["openPreview"];
}

export interface UseMemoHandlersReturn {
  handleGotoMemoDetailPage: () => void;
  handleMemoContentClick: (e: React.MouseEvent) => void;
  handleMemoContentDoubleClick: (e: React.MouseEvent) => void;
}

/**
 * Hook for managing memo event handlers
 * Centralizes all click and interaction handlers
 */
export const useMemoHandlers = (options: UseMemoHandlersOptions): UseMemoHandlersReturn => {
  const { memoName, parentPage, readonly, openEditor, openPreview } = options;
  const navigateTo = useNavigateTo();

  const handleGotoMemoDetailPage = useCallback(() => {
    navigateTo(`/${memoName}`, {
      state: { from: parentPage },
    });
  }, [memoName, parentPage, navigateTo]);

  const handleMemoContentClick = useCallback(
    (e: React.MouseEvent) => {
      const targetEl = e.target as HTMLElement;

      if (targetEl.tagName === "IMG") {
        // Check if the image is inside a link
        const linkElement = targetEl.closest("a");
        if (linkElement) {
          // If image is inside a link, only navigate to the link (don't show preview)
          return;
        }

        const imgUrl = targetEl.getAttribute("src");
        if (imgUrl) {
          openPreview(imgUrl);
        }
      }
    },
    [openPreview],
  );

  const handleMemoContentDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (readonly) return;

      const instanceMemoRelatedSetting = instanceStore.state.memoRelatedSetting;
      if (instanceMemoRelatedSetting.enableDoubleClickEdit) {
        e.preventDefault();
        openEditor();
      }
    },
    [readonly, openEditor],
  );

  return {
    handleGotoMemoDetailPage,
    handleMemoContentClick,
    handleMemoContentDoubleClick,
  };
};
