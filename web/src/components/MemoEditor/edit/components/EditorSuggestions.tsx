import { Button, Spinner, Tooltip } from "@usememos/ui";
import { isEqual, uniqBy } from "lodash-es";
import { ListTodoIcon, ZapIcon } from "lucide-react";
import { type ReactNode, type RefObject, useEffect, useId, useState } from "react";
import { useOverflowTitle } from "@/hooks/useOverflowTitle";
import { MAX_MEMO_SUGGESTIONS, type MemoSuggestion, type SuggestionItem } from "@/lib/memo-suggestions";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { getAssignableVisibilityOptions, getVisibilityOption } from "@/utils/memo";
import { useEditorContext, useEditorSelector } from "../state";
import type { EditorController } from "../types/editorController";

/** Shared UI for all suggestion kinds. Payloads and application belong to the caller. */
export function SuggestionsBar({
  suggestions,
  disabled,
  onAccept,
  status,
}: {
  suggestions: readonly SuggestionItem[];
  disabled: boolean;
  status?: ReactNode;
  onAccept: (id: string) => void;
}) {
  const t = useTranslate();
  const labelId = useId();
  if (!suggestions.length && !status) return null;
  return (
    <div role="group" aria-labelledby={labelId} className="flex w-full items-start gap-2 mu-caption">
      <span id={labelId} className="inline-flex h-6 shrink-0 items-center gap-1.5 text-mu-text-secondary">
        <ZapIcon className="mu-icon-sm" aria-hidden />
        {t("editor.suggestions")}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
        {suggestions.map((suggestion) => (
          <SuggestionButton key={suggestion.id} suggestion={suggestion} disabled={disabled} onAccept={onAccept} />
        ))}
        {status}
      </div>
    </div>
  );
}

function SuggestionButton({
  suggestion,
  disabled,
  onAccept,
}: {
  suggestion: SuggestionItem;
  disabled: boolean;
  onAccept: (id: string) => void;
}) {
  const { ref, title } = useOverflowTitle<HTMLSpanElement>(suggestion.label);
  const isPath = suggestion.label.startsWith("#") && suggestion.label.includes("/");
  return (
    <Tooltip.Root disabled={!title}>
      <Tooltip.Trigger
        render={
          // A raw button, not the package Button: the dashed outline marks an offer rather than an action already taken.
          <button
            type="button"
            disabled={disabled}
            aria-label={suggestion.accessibleLabel ?? suggestion.label}
            className={cn(
              "inline-flex min-h-6 max-w-full cursor-pointer touch-manipulation select-none items-center gap-1 rounded-mu-md border border-dashed border-mu-text-secondary/45 mu-caption text-mu-text-secondary transition-colors hover:bg-mu-hover hover:text-mu-text active:bg-mu-hover active:text-mu-text disabled:cursor-not-allowed disabled:opacity-45 mu-focus focus-visible:border-solid focus-visible:border-mu-focus",
              suggestion.icon ? "ps-[3px] pe-[5px]" : "px-[5px]",
            )}
            onClick={() => onAccept(suggestion.id)}
          >
            {suggestion.icon && <suggestion.icon className="mu-icon-xs shrink-0" aria-hidden />}
            <span
              ref={ref}
              dir={isPath ? "rtl" : undefined}
              className="block min-w-0 truncate [@media(pointer:coarse)]:whitespace-normal [@media(pointer:coarse)]:wrap-anywhere"
            >
              <bdi>{suggestion.label}</bdi>
            </span>
          </button>
        }
      />
      {title && <Tooltip.Popup className="max-w-[min(24rem,90vw)] wrap-anywhere">{title}</Tooltip.Popup>}
    </Tooltip.Root>
  );
}

/** Coordinates draft eligibility and acceptance; each kind owns its application. */
export function EditorSuggestions({
  suggestions,
  controllerRef,
  onRetry,
  space,
}: {
  suggestions: readonly MemoSuggestion[];
  controllerRef: RefObject<EditorController | null>;
  onRetry?: (content: string) => void;
  space?: string;
}) {
  const t = useTranslate();
  const { actions, dispatch } = useEditorContext();
  const content = useEditorSelector((state) => state.content);
  const acceptedIds = useEditorSelector((state) => state.acceptedSuggestionIds);
  const isSaving = useEditorSelector((state) => state.ui.isLoading.saving);
  const visibility = useEditorSelector((state) => state.metadata.visibility);
  const [tags, setTags] = useState<string[]>([]);
  const [hasChecklist, setHasChecklist] = useState(false);
  const requested = useEditorSelector((state) => state.tagSuggestions);
  const aiTags: MemoSuggestion[] =
    requested?.status === "ready"
      ? requested.tags.map((tag) => ({
          id: `tag:${tag}`,
          kind: "tag",
          source: "ai",
          tag,
        }))
      : [];
  const needsTags = [...suggestions, ...aiTags].some((suggestion) => suggestion.kind === "tag");
  const needsChecklist = suggestions.some((suggestion) => suggestion.kind === "checklist");
  // Read after the editor has applied restored/external content in its own effect.
  // The document scans only pay off when a tag or checklist suggestion exists.
  useEffect(() => {
    const controller = controllerRef.current;
    if ((!needsTags && !needsChecklist) || !controller || controller.getMarkdown() !== content) return;
    if (needsTags) {
      const next = controller.getTags();
      setTags((prev) => (isEqual(prev, next) ? prev : next));
    }
    if (needsChecklist) setHasChecklist(controller.hasChecklist());
  }, [content, controllerRef, needsTags, needsChecklist]);

  if (!content.trim()) return null;

  const visibilityOptions = getAssignableVisibilityOptions({ hasSpacePlacement: Boolean(space), current: visibility });
  const isOpen = (suggestion: MemoSuggestion) => {
    if (acceptedIds.includes(suggestion.id)) return false;
    switch (suggestion.kind) {
      case "tag":
        return !tags.includes(suggestion.tag);
      case "checklist":
        return !hasChecklist;
      case "visibility":
        return suggestion.visibility !== visibility && visibilityOptions.some((option) => option.value === suggestion.visibility);
    }
  };
  // Requested tags follow the pills already shown, so an answer that arrives later moves nothing
  // the writer may be reaching for. They are asked for, so they do not compete for the three slots.
  const requestedTags = aiTags.filter(isOpen);
  const visible = uniqBy([...suggestions.filter(isOpen).slice(0, MAX_MEMO_SUGGESTIONS), ...requestedTags], "id").map(
    (suggestion): MemoSuggestion & SuggestionItem => {
      switch (suggestion.kind) {
        case "tag": {
          const label = `#${suggestion.tag}`;
          return { ...suggestion, label, accessibleLabel: `${t("common.add")} ${label}` };
        }
        case "checklist":
          return { ...suggestion, label: t("editor.format.task-list"), icon: ListTodoIcon };
        case "visibility": {
          const option = getVisibilityOption(suggestion.visibility)!;
          return { ...suggestion, label: t("editor.set-visibility", { visibility: t(option.labelKey) }), icon: option.icon };
        }
      }
    },
  );

  const accept = (id: string) => {
    const suggestion = visible.find((item) => item.id === id);
    const controller = controllerRef.current;
    if (!suggestion || !controller) return;
    let applied = false;
    switch (suggestion.kind) {
      case "tag":
        applied = controller.insertTag(suggestion.tag);
        break;
      case "checklist": {
        if (controller.hasChecklist()) return;
        applied = controller.toggleTaskList();
        controller.focus();
        break;
      }
      case "visibility":
        // Assignability was checked when the chip was rendered from the same state.
        dispatch(actions.setMetadata({ visibility: suggestion.visibility }));
        controller.focus();
        applied = true;
        break;
    }
    if (applied) dispatch(actions.acceptSuggestion(suggestion.id));
  };

  const message =
    requested?.status === "loading"
      ? t("editor.blocks.loading")
      : requested?.status === "error"
        ? t("editor.tag-suggestions-error")
        : requested?.status === "limited"
          ? t("editor.tag-suggestions-limit")
          : requested?.status === "ready" && !requested.tags.length
            ? t("editor.no-suggested-tags")
            : undefined;
  // Asking again helps after a failure, or once the draft that got an empty answer has changed.
  const canRetry = requested?.status === "error" || (requested?.status === "ready" && !requested.tags.length && requested.stale);
  const status = message && (
    <div className="inline-flex min-h-6 items-center gap-1.5 text-mu-text-secondary">
      <span aria-hidden="true" className="inline-flex items-center gap-1">
        {requested?.status === "loading" && <Spinner size="sm" aria-hidden />}
        {message}
      </span>
      {canRetry && onRetry && (
        <Button variant="ghost" size="sm" onClick={() => onRetry(content)}>
          {t("common.retry")}
        </Button>
      )}
    </div>
  );
  const suggestedTagCount = requestedTags.length;
  return (
    <>
      <span className="mu-visually-hidden" role="status" aria-atomic="true">
        {message ?? (suggestedTagCount > 0 ? `${t("editor.tag-suggestions-label")} (${suggestedTagCount})` : "")}
      </span>
      <SuggestionsBar suggestions={visible} disabled={isSaving} onAccept={accept} status={status} />
    </>
  );
}
