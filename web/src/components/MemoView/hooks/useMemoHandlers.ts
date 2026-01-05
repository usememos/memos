import { useCallback } from "react";
import { useInstance } from "@/contexts/InstanceContext";
import useNavigateTo from "@/hooks/useNavigateTo";

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
  const { memoRelatedSetting } = useInstance();

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
      if (memoRelatedSetting.enableDoubleClickEdit) {
        e.preventDefault();
        openEditor();
      }
    },
    [readonly, openEditor, memoRelatedSetting.enableDoubleClickEdit],
  );

  return { handleGotoMemoDetailPage, handleMemoContentClick, handleMemoContentDoubleClick };
};
