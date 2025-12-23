import { useEffect, useRef } from "react";
import type { EditorRefActions } from "../Editor";
import { cacheService, memoService } from "../services";
import { useEditorContext } from "../state";

export const useMemoInit = (
  editorRef: React.RefObject<EditorRefActions | null>,
  memoName: string | undefined,
  cacheKey: string | undefined,
  username: string,
  autoFocus?: boolean,
) => {
  const { actions } = useEditorContext();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const init = async () => {
      actions.setLoading("loading", true);

      try {
        if (memoName) {
          // Load existing memo
          const loadedState = await memoService.load(memoName);
          actions.initMemo({
            content: loadedState.content,
            metadata: loadedState.metadata,
            timestamps: loadedState.timestamps,
          });
        } else {
          // Load from cache for new memo
          const cachedContent = cacheService.load(cacheService.key(username, cacheKey));
          if (cachedContent) {
            actions.updateContent(cachedContent);
          }
        }
      } catch (error) {
        console.error("Failed to initialize editor:", error);
      } finally {
        actions.setLoading("loading", false);

        if (autoFocus) {
          setTimeout(() => {
            editorRef.current?.focus();
          }, 100);
        }
      }
    };

    init();
  }, [memoName, cacheKey, username, autoFocus, actions, editorRef]);
};
