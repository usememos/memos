import { autocompletion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import type { Extension } from "@codemirror/state";
import { isTagIntroducerAt } from "@/utils/tag-grammar";
import { isLiteralTagPosition, tagMatchBefore } from "./markdownTagRanges";

export function makeTagCompletionSource(getTags: () => string[]) {
  return (ctx: CompletionContext): CompletionResult | null => {
    const match = tagMatchBefore(ctx.state, ctx.pos);
    const source = ctx.state.doc.toString();
    const explicitBareIntroducer =
      ctx.explicit && ctx.pos > 0 && isTagIntroducerAt(source, ctx.pos - 1) && isLiteralTagPosition(ctx.state, ctx.pos);
    if (!match && !explicitBareIntroducer) return null;

    const typed = (match?.value ?? "").toLowerCase();
    const options = getTags()
      .filter((tag) => tag.toLowerCase().startsWith(typed))
      .map((tag) => ({ label: tag, type: "keyword" }));
    if (options.length === 0) return null;
    return { from: match ? match.from + 1 : ctx.pos, options };
  };
}

export function tagAutocomplete(getTags: () => string[]): Extension {
  return autocompletion({
    override: [makeTagCompletionSource(getTags)],
    icons: false,
  });
}
