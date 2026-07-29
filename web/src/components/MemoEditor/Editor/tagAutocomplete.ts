import { autocompletion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import type { Extension } from "@codemirror/state";
import { TAG_CHAR_CLASS } from "@/utils/tag-grammar";

const TAG_BEFORE = new RegExp(`#(${TAG_CHAR_CLASS}*)$`, "u");

export function makeTagCompletionSource(getTags: () => string[]) {
  return (ctx: CompletionContext): CompletionResult | null => {
    const before = ctx.matchBefore(TAG_BEFORE);
    if (!before || (before.from === before.to && !ctx.explicit)) return null;
    const typed = before.text.slice(1).toLowerCase();
    // Require at least one character after `#` unless completion was explicitly
    // invoked, so a bare `#` doesn't pop the menu while typing.
    if (typed.length < 1 && !ctx.explicit) return null;
    const options = getTags()
      .filter((tag) => tag.toLowerCase().startsWith(typed))
      .map((tag) => ({ label: tag, type: "keyword" }));
    if (options.length === 0) return null;
    return { from: before.from + 1, options };
  };
}

export function tagAutocomplete(getTags: () => string[]): Extension {
  return autocompletion({
    override: [makeTagCompletionSource(getTags)],
    icons: false,
  });
}
