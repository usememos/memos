import { equals } from "@bufbuild/protobuf";
import { useCallback, useEffect, useRef } from "react";
import { AttachmentSchema } from "@/types/proto/api/v1/attachment_service_pb";
import { cacheService, type EditorDraft } from "../services";
import { useEditorStore } from "../state";

const sameDraft = (left: EditorDraft, right: EditorDraft): boolean =>
  left.content === right.content &&
  left.attachments.length === right.attachments.length &&
  left.attachments.every((attachment, index) => {
    const other = right.attachments[index];
    return other !== undefined && equals(AttachmentSchema, attachment, other);
  });

/**
 * Persists the editor's content and already-uploaded attachments to localStorage
 * as a draft. Subscribes to the editor store directly rather than taking draft
 * state as props, so the component that mounts this hook does not re-render on
 * every keystroke.
 */
export const useAutoSave = (username: string, cacheKey: string | undefined, enabled = true) => {
  const store = useEditorStore();
  const initialState = store.getState();
  const latestDraftRef = useRef<EditorDraft>({ content: initialState.content, attachments: initialState.metadata.attachments });
  const discardedDraftRef = useRef<EditorDraft | undefined>(undefined);

  useEffect(() => {
    if (!enabled) return;

    const key = cacheService.key(username, cacheKey);
    const persist = (draft: EditorDraft) => {
      latestDraftRef.current = draft;
      if (discardedDraftRef.current !== undefined && !sameDraft(discardedDraftRef.current, draft)) {
        discardedDraftRef.current = undefined;
      }
      cacheService.save(key, draft.content, draft.attachments);
    };

    // Persist the current draft on mount/enable, then on every relevant change.
    const state = store.getState();
    persist({ content: state.content, attachments: state.metadata.attachments });
    return store.subscribe(() => {
      const nextState = store.getState();
      const draft = { content: nextState.content, attachments: nextState.metadata.attachments };
      if (!sameDraft(draft, latestDraftRef.current)) {
        persist(draft);
      }
    });
  }, [store, username, cacheKey, enabled]);

  useEffect(() => {
    if (!enabled) return;

    const key = cacheService.key(username, cacheKey);
    const flushDraft = () => {
      if (discardedDraftRef.current && sameDraft(discardedDraftRef.current, latestDraftRef.current)) {
        return;
      }

      cacheService.saveNow(key, latestDraftRef.current.content, latestDraftRef.current.attachments);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushDraft();
      }
    };

    window.addEventListener("pagehide", flushDraft);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      // Flush on unmount (e.g. editor closes) to ensure the draft is persisted
      // before the component is torn down — distinct from the visibility flush above.
      flushDraft();
      window.removeEventListener("pagehide", flushDraft);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [store, username, cacheKey, enabled]);

  const discardDraft = useCallback(() => {
    const key = cacheService.key(username, cacheKey);
    discardedDraftRef.current = latestDraftRef.current;
    cacheService.clear(key);
  }, [username, cacheKey]);

  return { discardDraft };
};
