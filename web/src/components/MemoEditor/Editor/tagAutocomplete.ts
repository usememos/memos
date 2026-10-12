import { autocompletion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { findTagMatches, isTagIntroducerAt } from "@/utils/tag-grammar";

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
    // Completion is an input aid, including inside code, links, and escapes.
    // Keep tag spelling rules, but don't restrict candidates to rendered tags.
    const line = ctx.state.doc.lineAt(ctx.pos);
    const position = ctx.pos - line.from;
    const match = findTagMatches(line.text, 0, position).findLast(
      (candidate) => candidate.to === position || (candidate.to === position - 1 && line.text[position - 1] === "/"),
    );
    const bareIntroducer = isTagIntroducerAt(line.text, position - 1);
    if (!match && !bareIntroducer) return null;

    const from = match ? line.from + match.from + 1 : ctx.pos;
    if (!ctx.explicit) {
      const tree = ensureSyntaxTree(ctx.state, ctx.pos) ?? syntaxTree(ctx.state);
      const node = tree.resolveInner(from - 1, 1);
      // Only the opening heading marker is reserved. A later # in heading
      // text still offers tags, including a potential closing heading marker.
      if (node.name === "HeaderMark" && node.parent?.firstChild?.from === node.from) return null;
    }

    // A trailing slash is an unfinished child segment, not the end of input.
    const typed = (match ? match.value + (match.to < position ? "/" : "") : "").toLowerCase();
    const options = getTags()
      .map((tag) => ({ tag, rank: matchRank(tag.toLowerCase(), typed) }))
      .filter((candidate): candidate is { tag: string; rank: number } => candidate.rank !== undefined)
      // Stable sort, so tags keep their incoming order within a tier.
      .sort((a, b) => a.rank - b.rank)
      .map(({ tag }) => ({ label: tag, type: "keyword" }));
    if (options.length === 0) return null;
    // `filter: false` keeps this ranking: CodeMirror would otherwise re-filter
    // and re-score the options with its own fuzzy matcher.
    return { from, options, filter: false };
  };
}

export function tagAutocomplete(getTags: () => string[]): Extension {
  return autocompletion({
    override: [makeTagCompletionSource(getTags)],
    icons: false,
  });
}
