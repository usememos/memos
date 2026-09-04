import { useEffect, useRef, useState } from "react";
import type { Memo, Visibility } from "@/types/proto/api/v1/memo_service_pb";
import { cacheService, memoService } from "../services";
import { useEditorContext } from "../state";
import type { EditorController } from "../types/editorController";

interface UseMemoInitOptions {
  editorRef: React.RefObject<EditorController | null>;
  memo?: Memo;
  cacheKey?: string;
  username: string;
  autoFocus?: boolean | (() => boolean);
  defaultVisibility?: Visibility;
  defaultCreateTime?: Date;
}

export const useMemoInit = ({
  editorRef,
  memo,
  cacheKey,
  username,
  autoFocus,
  defaultVisibility,
  defaultCreateTime,
}: UseMemoInitOptions) => {
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
      const cachedDraft = cacheService.loadDraft(key);
      if (cachedDraft.content) {
        dispatch(actions.setContent(cachedDraft.content));
      }
      if (cachedDraft.attachments.length > 0) {
        dispatch(actions.setMetadata({ attachments: cachedDraft.attachments }));
      }
      if (defaultVisibility !== undefined) {
        dispatch(actions.setMetadata({ visibility: defaultVisibility }));
      }
      if (defaultCreateTime) {
        dispatch(actions.setTimestamps({ createTime: defaultCreateTime, updateTime: defaultCreateTime }));
      }
    }

    const cachedCursor = cacheService.loadCursor(key);
    let restoreCursorTimer: ReturnType<typeof setTimeout> | undefined;
    if (autoFocus || cachedCursor !== undefined) {
      restoreCursorTimer = setTimeout(() => {
        if (cachedCursor !== undefined) {
          editorRef.current?.setCursor(cachedCursor);
        }
        if (typeof autoFocus === "function" ? autoFocus() : autoFocus) {
          editorRef.current?.focus();
        }
      }, 100);
    }

    setIsInitialized(true);
    return () => {
      if (restoreCursorTimer) {
        clearTimeout(restoreCursorTimer);
      }
    };
  }, [memo, cacheKey, username, autoFocus, defaultVisibility, defaultCreateTime, actions, dispatch, editorRef]);

  return { isInitialized };
};
