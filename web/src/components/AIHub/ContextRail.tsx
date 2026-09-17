import { HashIcon, Loader2Icon, TriangleAlertIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { describeContextSelection, formatTokenCount } from "@/lib/ai-context";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";

interface ContextRailProps {
  /** Tag names with note counts, from the same stats the sidebar uses. */
  availableTags: Array<{ tag: string; count: number }>;
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  onClearTags: () => void;
  /** Server-resolved estimate for the current selection. */
  memoCount: number;
  estimatedTokens: number;
  budgetTokens: number;
  isEstimating: boolean;
  /** Set when the selection could not be resolved. */
  estimateError: string | undefined;
}

/**
 * The explicit context selector. Everything the model will read is chosen here
 * and summarized here, so an accidental or oversized selection is visible
 * before a turn is sent.
 */
const ContextRail = ({
  availableTags,
  selectedTags,
  onToggleTag,
  onClearTags,
  memoCount,
  estimatedTokens,
  budgetTokens,
  isEstimating,
  estimateError,
}: ContextRailProps) => {
  const t = useTranslate();
  const [query, setQuery] = useState("");

  const filteredTags = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (normalized === "") return availableTags;
    return availableTags.filter((entry) => entry.tag.toLowerCase().includes(normalized));
  }, [availableTags, query]);

  const overBudget = estimatedTokens > budgetTokens;
  const hasSelection = selectedTags.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">{t("ai.context-title")}</h2>
          {hasSelection && (
            <button type="button" onClick={onClearTags} className="text-xs text-muted-foreground hover:text-foreground">
              {t("ai.context-clear")}
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{t("ai.context-description")}</p>
      </div>

      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("ai.context-search-tags")}
        aria-label={t("ai.context-search-tags")}
      />

      <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]">
        {availableTags.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("ai.context-no-tags")}</p>
        ) : filteredTags.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("ai.context-no-matching-tags")}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {filteredTags.map((entry) => {
              const selected = selectedTags.includes(entry.tag);
              return (
                <button
                  key={entry.tag}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onToggleTag(entry.tag)}
                  className={cn(
                    "inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors",
                    selected
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  <HashIcon className="size-3 shrink-0" strokeWidth={2} />
                  <span className="truncate">{entry.tag}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground/70">{entry.count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-2 text-xs">
          {isEstimating ? (
            <Loader2Icon className="size-3.5 shrink-0 animate-spin text-muted-foreground" strokeWidth={2} />
          ) : overBudget ? (
            <TriangleAlertIcon className="size-3.5 shrink-0 text-destructive" strokeWidth={2} />
          ) : null}
          <span className={cn("tabular-nums", overBudget ? "text-destructive" : "text-muted-foreground")}>
            {isEstimating ? t("ai.context-estimating") : describeContextSelection(memoCount, estimatedTokens, budgetTokens)}
          </span>
        </div>
        {estimateError && <p className="mt-1 text-xs text-destructive">{estimateError}</p>}
        {!isEstimating && !estimateError && overBudget && (
          <p className="mt-1 text-xs text-destructive">
            {t("ai.context-over-budget", { over: formatTokenCount(estimatedTokens - budgetTokens) })}
          </p>
        )}
        {!hasSelection && !estimateError && <p className="mt-1 text-xs text-muted-foreground">{t("ai.context-empty-warning")}</p>}
      </div>
    </div>
  );
};

export default ContextRail;
