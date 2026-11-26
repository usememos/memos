import { Badge, Button, Dialog, Field, Textarea } from "@usememos/ui";
import { CircleAlertIcon, HashIcon, TagsIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { toCandidateTags } from "@/components/MemoEditor/edit/hooks/useTagSuggestions";
import { aiServiceClient } from "@/connect";
import { useTagCounts } from "@/hooks/useUserQueries";
import { getErrorMessage } from "@/lib/error";
import { useTranslate } from "@/utils/i18n";
import PlaygroundSource from "./PlaygroundSource";

type Result = { status: "pending" } | { status: "done"; tags: string[] } | { status: "failed"; message: string };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The saved provider and model, which every run uses. */
  source: string;
  /** The form on the page differs from what is saved. */
  unsaved: boolean;
}

/** Runs SuggestTags on a note the administrator writes, the call the composer makes, with the writer's own tags as candidates. */
const TagSuggestionsPlayground = ({ open, onOpenChange, source, unsaved }: Props) => {
  const t = useTranslate();
  const formId = useId();
  const [content, setContent] = useState("");
  const [result, setResult] = useState<Result>();
  const { data: counts } = useTagCounts(true);
  const request = useRef<AbortController | undefined>(undefined);
  const pending = result?.status === "pending";

  // Closing the dialog, or leaving the page, cancels the request in flight.
  useEffect(() => {
    if (!open) return;
    return () => request.current?.abort();
  }, [open]);

  const run = async () => {
    if (!content.trim() || pending) return;
    const controller = new AbortController();
    request.current = controller;
    setResult({ status: "pending" });
    try {
      const { tags } = await aiServiceClient.suggestTags(
        { content, candidateTags: toCandidateTags(counts) },
        { signal: controller.signal },
      );
      if (!controller.signal.aborted) setResult({ status: "done", tags });
    } catch (error) {
      if (!controller.signal.aborted) setResult({ status: "failed", message: getErrorMessage(error) });
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Popup closeLabel={t("common.close")} style={{ "--mu-dialog-width": "40rem" } as React.CSSProperties}>
        <Dialog.Title>{t("setting.ai.try-tags-title")}</Dialog.Title>
        <Dialog.Description>{t("setting.ai.try-tags-description")}</Dialog.Description>
        <form
          id={formId}
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void run();
          }}
        >
          <Field.Root>
            <Field.Label>{t("setting.ai.try-note")}</Field.Label>
            <Textarea
              value={content}
              rows={4}
              maxLength={65536}
              onChange={(event) => setContent(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  void run();
                }
              }}
            />
          </Field.Root>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <PlaygroundSource source={source} unsaved={unsaved} />
            <Button type="submit" variant="primary" loading={pending} disabled={!content.trim()}>
              {t("setting.ai.suggest-tags")}
            </Button>
          </div>
        </form>
        <div
          role="status"
          aria-busy={pending}
          className="flex min-h-20 flex-col justify-center gap-2 rounded-mu-md border border-mu-line px-3 py-2.5"
        >
          {(!result || pending) && (
            <p className="flex items-center justify-center gap-1.5 mu-caption text-mu-text-secondary">
              <TagsIcon aria-hidden className="mu-icon-sm" />
              {t("setting.ai.suggested-tags-empty")}
            </p>
          )}
          {result?.status === "failed" && (
            <p className="flex items-baseline gap-1.5 mu-caption text-mu-danger">
              <CircleAlertIcon aria-hidden className="mu-icon-sm shrink-0 translate-y-0.5" />
              <span className="min-w-0 wrap-anywhere">{result.message}</span>
            </p>
          )}
          {result?.status === "done" &&
            (result.tags.length ? (
              <>
                <p className="mu-caption text-mu-text-secondary">{t("setting.ai.suggested-tags")}</p>
                <ul className="flex flex-wrap gap-1.5">
                  {result.tags.map((tag) => (
                    <li key={tag}>
                      <Badge icon={<HashIcon />}>{tag}</Badge>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mu-caption text-mu-text-secondary">{t("setting.ai.no-tags-suggested")}</p>
            ))}
        </div>
      </Dialog.Popup>
    </Dialog.Root>
  );
};

export default TagSuggestionsPlayground;
