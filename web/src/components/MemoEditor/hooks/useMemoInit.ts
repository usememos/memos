import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import type { Memo, Visibility } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { isLosslessRoundTrip } from "../Editor/markdownCodec";
import { getPreferredEditorMode } from "../editorMode";
import { cacheService, memoService } from "../services";
import { useEditorContext } from "../state";
import type { EditorController } from "../types/editorController";

interface UseMemoInitOptions {
  editorRef: React.RefObject<EditorController | null>;
  memo?: Memo;
  cacheKey?: string;
  username: string;
  autoFocus?: boolean;
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
  const t = useTranslate();
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
      // Load guard (tripwire): if the WYSIWYG round trip would change this
      // memo's meaning, edit it raw for this session. Preference untouched —
      // and INIT_MEMO ignores ui state, so the mode must be dispatched here.
      // No length cap: the check runs in a useEffect (post-paint). Add a cap
      // if profiling ever identifies cost on very large memos.
      if (getPreferredEditorMode() === "wysiwyg" && initialState.content && !isLosslessRoundTrip(initialState.content)) {
        console.warn("memo content failed wysiwyg round-trip; falling back to raw editor", memo.name);
        dispatch(actions.setEditorMode("raw"));
        toast(t("editor.unsupported-syntax-raw-mode"));
      }
    } else {
      const cachedContent = cacheService.load(key);
      if (cachedContent) {
        dispatch(actions.updateContent(cachedContent));
      }
      if (defaultVisibility !== undefined) {
        dispatch(actions.setMetadata({ visibility: defaultVisibility }));
      }
      if (defaultCreateTime) {
        dispatch(actions.setTimestamps({ createTime: defaultCreateTime, updateTime: defaultCreateTime }));
      }
    }

    if (autoFocus) {
      setTimeout(() => editorRef.current?.focus(), 100);
    }

    setIsInitialized(true);
  }, [memo, cacheKey, username, autoFocus, defaultVisibility, defaultCreateTime, actions, dispatch, editorRef, t]);

  return { isInitialized };
};
