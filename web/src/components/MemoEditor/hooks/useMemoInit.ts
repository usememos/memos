import { useEffect, useRef, useState } from "react";
import type { Memo, Visibility } from "@/types/proto/api/v1/memo_service_pb";
import type { EditorRefActions } from "../Editor";
import { cacheService, memoService } from "../services";
import { useEditorContext } from "../state";

interface UseMemoInitOptions {
  editorRef: React.RefObject<EditorRefActions | null>;
  memo?: Memo;
  cacheKey?: string;
  username: string;
  autoFocus?: boolean;
  defaultVisibility?: Visibility;
}

export const useMemoInit = ({ editorRef, memo, cacheKey, username, autoFocus, defaultVisibility }: UseMemoInitOptions) => {
  const { actions, dispatch } = useEditorContext();
  const initializedRef = useRef(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    const key = cacheService.key(username, cacheKey);

    if (memo) {
      const initialState = memoService.fromMemo(memo);
      cacheService.clear(key);
      dispatch(actions.initMemo(initialState));
    } else {
      const cachedContent = cacheService.load(key);
      if (cachedContent) {
        dispatch(actions.updateContent(cachedContent));
      }
      if (defaultVisibility !== undefined) {
        dispatch(actions.setMetadata({ visibility: defaultVisibility }));
      }
    }

    if (autoFocus) {
      setTimeout(() => editorRef.current?.focus(), 100);
    }

    setIsInitialized(true);
  }, [memo, cacheKey, username, autoFocus, defaultVisibility, actions, dispatch, editorRef]);

  return { isInitialized };
};
