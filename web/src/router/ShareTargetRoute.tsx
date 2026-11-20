import { useEffect, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useGlobalMemoEditor } from "@/contexts/GlobalMemoEditorContext";
import { sharedDataFromSearch, sharedDataToMarkdown } from "@/lib/share-target";
import { ROUTES } from "./routes";

/**
 * The Web Share Target (`share_target` in `site.webmanifest`): an item shared from
 * another app opens the composer over Home with the item appended to its draft.
 */
export const ShareTargetRoute = () => {
  const location = useLocation();
  const { openEditorWithContent } = useGlobalMemoEditor();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    const content = sharedDataToMarkdown(sharedDataFromSearch(location.search));
    if (content) openEditorWithContent(content);
  }, [location.search, openEditorWithContent]);

  return <Navigate to={ROUTES.HOME} replace />;
};
