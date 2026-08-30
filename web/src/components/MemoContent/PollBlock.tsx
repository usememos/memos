import { CheckIcon, VoteIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import useCurrentUser from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { getPollVotes, setPollVotes } from "./poll/pollApi";
import { parsePollDefinition } from "./poll/types";

interface PollBlockProps {
  content: string;
}

export const PollBlock = ({ content }: PollBlockProps) => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const poll = parsePollDefinition(content);

  const [tallies, setTallies] = useState<number[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const applyVotes = useCallback(
    (votes: { optionIndex: number; voter: string }[], optionCount: number) => {
      const counts = new Array(optionCount).fill(0);
      const mine = new Set<number>();
      for (const vote of votes) {
        if (vote.optionIndex < 0 || vote.optionIndex >= optionCount) continue;
        counts[vote.optionIndex] += 1;
        if (currentUser && vote.voter === currentUser.name) {
          mine.add(vote.optionIndex);
        }
      }
      setTallies(counts);
      setSelected(mine);
    },
    [currentUser],
  );

  useEffect(() => {
    if (!poll) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getPollVotes(poll.id)
      .then((response) => {
        if (cancelled) return;
        applyVotes(response.votes, poll.options.length);
      })
      .catch(() => {
        if (!cancelled) {
          setTallies(new Array(poll.options.length).fill(0));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Only re-fetch when the poll identity/shape actually changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poll?.id, poll?.options.length]);

  if (!poll) {
    return (
      <pre className="relative my-2 rounded-lg border border-border bg-muted/20 overflow-hidden p-3 text-sm text-muted-foreground">
        {t("editor.poll.invalid-block")}
      </pre>
    );
  }

  const totalVotes = tallies.reduce((sum, count) => sum + count, 0);

  const handleToggleOption = async (index: number) => {
    if (!currentUser) {
      toast.error(t("editor.poll.sign-in-to-vote"));
      return;
    }
    if (submitting) return;

    let nextSelected: Set<number>;
    if (poll.type === "single") {
      nextSelected = selected.has(index) ? new Set<number>() : new Set([index]);
    } else {
      nextSelected = new Set(selected);
      if (nextSelected.has(index)) {
        nextSelected.delete(index);
      } else {
        nextSelected.add(index);
      }
    }

    setSubmitting(true);
    // Optimistic update so the click feels instant; reconciled with the
    // server's authoritative tally right after.
    const previousTallies = tallies;
    const previousSelected = selected;
    const optimisticTallies = tallies.slice();
    for (const i of previousSelected) optimisticTallies[i] -= 1;
    for (const i of nextSelected) optimisticTallies[i] += 1;
    setSelected(nextSelected);
    setTallies(optimisticTallies);

    try {
      const response = await setPollVotes(poll.id, Array.from(nextSelected));
      applyVotes(response.votes, poll.options.length);
    } catch {
      setSelected(previousSelected);
      setTallies(previousTallies);
      toast.error(t("editor.poll.vote-failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="my-2 rounded-lg border border-border bg-muted/10 p-3 flex flex-col gap-2 not-prose">
      <div className="flex items-center gap-2 font-medium text-sm">
        <VoteIcon className="w-4 h-4 text-muted-foreground shrink-0" />
        <span>{poll.question}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        {poll.options.map((option, index) => {
          const count = tallies[index] ?? 0;
          const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const isSelected = selected.has(index);
          return (
            <button
              key={index}
              type="button"
              disabled={loading || submitting}
              onClick={() => void handleToggleOption(index)}
              className={cn(
                "relative w-full text-left rounded-md border overflow-hidden px-2.5 py-1.5 text-sm transition-colors",
                "hover:bg-accent disabled:cursor-default",
                isSelected ? "border-primary" : "border-border",
              )}
            >
              <div
                className={cn("absolute inset-y-0 left-0 bg-primary/15", isSelected && "bg-primary/25")}
                style={{ width: `${percentage}%` }}
                aria-hidden
              />
              <div className="relative flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={cn(
                      "inline-flex items-center justify-center shrink-0 w-4 h-4 border text-primary-foreground",
                      poll.type === "single" ? "rounded-full" : "rounded-sm",
                      isSelected ? "bg-primary border-primary" : "border-muted-foreground/40 bg-transparent",
                    )}
                  >
                    {isSelected && <CheckIcon className="w-3 h-3" />}
                  </span>
                  <span className="truncate">{option}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {count} · {percentage}%
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="text-xs text-muted-foreground">
        {totalVotes === 1
          ? t("editor.poll.total-votes_one", { count: totalVotes })
          : t("editor.poll.total-votes_other", { count: totalVotes })}
        {poll.type === "multiple" && ` · ${t("editor.poll.allow-multiple")}`}
      </div>
    </div>
  );
};
