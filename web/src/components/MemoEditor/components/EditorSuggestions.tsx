import { isEqual } from "lodash-es";
import { ListTodoIcon, ZapIcon } from "lucide-react";
import { type RefObject, useId, useLayoutEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
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
}: {
  suggestions: readonly SuggestionItem[];
  disabled: boolean;
  onAccept: (id: string) => void;
}) {
  const t = useTranslate();
  const labelId = useId();
  if (!suggestions.length) return null;
  return (
    <div role="group" aria-labelledby={labelId} className="flex w-full items-start gap-2 text-ui">
      <span id={labelId} className="inline-flex h-6 shrink-0 items-center gap-1.5 text-muted-foreground/70">
        <ZapIcon className="size-3.5" aria-hidden />
        {t("editor.suggestions")}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.id}
            type="button"
            disabled={disabled}
            aria-label={suggestion.accessibleLabel ?? suggestion.label}
            className={cn(
              buttonVariants({ variant: "quiet", size: "sm" }),
              "h-6 max-w-full gap-1 border border-dashed border-muted-foreground/30 px-1.5 text-muted-foreground hover:border-muted-foreground/50 has-[>svg]:px-1.5",
            )}
            onClick={() => onAccept(suggestion.id)}
          >
            {suggestion.icon && <suggestion.icon className="size-3" aria-hidden />}
            <span className="truncate">{suggestion.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Coordinates draft eligibility and acceptance; each kind owns its application. */
export function EditorSuggestions({
  suggestions,
  controllerRef,
  space,
}: {
  suggestions: readonly MemoSuggestion[];
  controllerRef: RefObject<EditorController | null>;
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
  const needsTags = suggestions.some((suggestion) => suggestion.kind === "tag");
  const needsChecklist = suggestions.some((suggestion) => suggestion.kind === "checklist");
  // Read after the editor has applied restored/external content in its layout effect.
  // The document scans only pay off when a tag or checklist suggestion exists.
  useLayoutEffect(() => {
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
  const visible = suggestions
    .filter((suggestion) => {
      if (acceptedIds.includes(suggestion.id)) return false;
      switch (suggestion.kind) {
        case "tag":
          return !tags.includes(suggestion.tag);
        case "checklist":
          return !hasChecklist;
        case "visibility":
          return suggestion.visibility !== visibility && visibilityOptions.some((option) => option.value === suggestion.visibility);
      }
    })
    .slice(0, MAX_MEMO_SUGGESTIONS)
    .map((suggestion): MemoSuggestion & SuggestionItem => {
      switch (suggestion.kind) {
        case "tag":
          return { ...suggestion, label: `#${suggestion.tag}`, accessibleLabel: `${t("common.add")} #${suggestion.tag}` };
        case "checklist":
          return { ...suggestion, label: t("editor.format.task-list"), icon: ListTodoIcon };
        case "visibility": {
          const option = getVisibilityOption(suggestion.visibility)!;
          return { ...suggestion, label: t(option.labelKey), icon: option.icon };
        }
      }
    });

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
        if (controller.hasChecklist() || !controller.formatting) return;
        const before = controller.getMarkdown();
        controller.formatting.run("taskList");
        applied = before !== controller.getMarkdown();
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

  return <SuggestionsBar suggestions={visible} disabled={isSaving} onAccept={accept} />;
}
