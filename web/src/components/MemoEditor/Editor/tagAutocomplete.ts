import { autocompletion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import type { Extension } from "@codemirror/state";
import { isTagIntroducerAt } from "@/utils/tag-grammar";
import { isLiteralTagPosition, tagMatchBefore } from "./markdownTagRanges";

/**
 * Ranks a candidate tag against the typed text (both already lower-cased).
 * Lower sorts first; `undefined` means the candidate does not match.
 *
 * Nested tags are paths, so a match inside the path counts: typing `mem` has to
 * reach `software/hosted/Memos`, which a full-path prefix test cannot do. The
 * tiers keep that from turning into noise — a segment start outranks an
 * incidental hit in the middle of a word.
 */
const matchRank = (tag: string, typed: string): number | undefined => {
  const index = tag.indexOf(typed);
  if (index < 0) return undefined;
  if (index === 0) return 0; // Full-path prefix.
  if (tag[index - 1] === "/") return 1; // Path-segment start.
  return 2; // Anywhere else.
};

export function makeTagCompletionSource(getTags: () => string[]) {
  return (ctx: CompletionContext): CompletionResult | null => {
    const match = tagMatchBefore(ctx.state, ctx.pos);
    const source = ctx.state.doc.toString();
    const explicitBareIntroducer =
      ctx.explicit && ctx.pos > 0 && isTagIntroducerAt(source, ctx.pos - 1) && isLiteralTagPosition(ctx.state, ctx.pos);
    if (!match && !explicitBareIntroducer) return null;

    const typed = (match?.value ?? "").toLowerCase();
    const options = getTags()
      .map((tag) => ({ tag, rank: matchRank(tag.toLowerCase(), typed) }))
      .filter((candidate): candidate is { tag: string; rank: number } => candidate.rank !== undefined)
      // Stable sort, so tags keep their incoming order within a tier.
      .sort((a, b) => a.rank - b.rank)
      .map(({ tag }) => ({ label: tag, type: "keyword" }));
    if (options.length === 0) return null;
    // `filter: false` keeps this ranking: CodeMirror would otherwise re-filter
    // and re-score the options with its own fuzzy matcher.
    return { from: match ? match.from + 1 : ctx.pos, options, filter: false };
  };
}

export function tagAutocomplete(getTags: () => string[]): Extension {
  return autocompletion({
    override: [makeTagCompletionSource(getTags)],
    icons: false,
  });
}
