import { Code, ConnectError } from "@connectrpc/connect";
import { useEffect, useRef } from "react";
import { aiServiceClient } from "@/connect";
import { useTagCounts } from "@/hooks/useUserQueries";
import { isCompleteTagValue } from "@/utils/tag-grammar";
import { type TagSuggestions, useEditorStore } from "../state";

/** The writer's most used tags, within the limits SuggestTags accepts, for the model to reuse. */
export function toCandidateTags(counts: Record<string, number> | undefined): string[] {
  const encoder = new TextEncoder();
  return Object.entries(counts ?? {})
    .sort(([, a], [, b]) => b - a)
    .map(([tag]) => tag)
    .filter((tag) => encoder.encode(tag).length <= 256 && isCompleteTagValue(tag))
    .slice(0, 64);
}

export function useTagSuggestions() {
  const store = useEditorStore();
  const { data: counts } = useTagCounts(true);
  const abort = useRef<AbortController | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      if (!store.getState().tagSuggestions) abort.current?.abort();
    });
    return () => {
      unsubscribe();
      abort.current?.abort();
    };
  }, [store]);

  return async (content: string) => {
    if (!content.trim() || store.getState().ui.isLoading.saving) return;
    abort.current?.abort();
    const request = new AbortController();
    abort.current = request;
    const pending: TagSuggestions = { status: "loading" };
    store.dispatch({ type: "SET_TAG_SUGGESTIONS", payload: pending });
    const isCurrent = () => !request.signal.aborted && store.getState().tagSuggestions === pending;
    const candidateTags = toCandidateTags(counts);
    try {
      const { tags } = await aiServiceClient.suggestTags({ content, candidateTags }, { signal: request.signal });
      if (isCurrent()) {
        store.dispatch({ type: "SET_TAG_SUGGESTIONS", payload: { status: "ready", tags } });
      }
    } catch (error) {
      if (isCurrent()) {
        const limited = error instanceof ConnectError && error.code === Code.ResourceExhausted;
        store.dispatch({ type: "SET_TAG_SUGGESTIONS", payload: { status: limited ? "limited" : "error" } });
      }
    }
  };
}
