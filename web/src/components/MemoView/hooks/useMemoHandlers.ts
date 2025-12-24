import { useCallback } from "react";
import useNavigateTo from "@/hooks/useNavigateTo";
import { instanceStore } from "@/store";

interface UseMemoHandlersOptions {
  memoName: string;
  parentPage: string;
  readonly: boolean;
  openEditor: () => void;
  openPreview: (url: string) => void;
}

export const useMemoHandlers = (options: UseMemoHandlersOptions) => {
  const { memoName, parentPage, readonly, openEditor, openPreview } = options;
  const navigateTo = useNavigateTo();

  const handleGotoMemoDetailPage = useCallback(() => {
    navigateTo(`/${memoName}`, { state: { from: parentPage } });
  }, [memoName, parentPage, navigateTo]);

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
      if (instanceStore.state.memoRelatedSetting.enableDoubleClickEdit) {
        e.preventDefault();
        openEditor();
      }
    },
    [readonly, openEditor],
  );

  return { handleGotoMemoDetailPage, handleMemoContentClick, handleMemoContentDoubleClick };
};
