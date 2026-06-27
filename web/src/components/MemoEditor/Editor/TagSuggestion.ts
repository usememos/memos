import { createElement } from "react";
import { createSuggestionExtension } from "./suggestionExtension";

export interface TagSuggestionOptions {
  /** Getter (not a snapshot) so the popup always sees freshly fetched tags. */
  getTags: () => string[];
}

const MAX_SUGGESTIONS = 20;

/** `#` popup backed by the user's existing tags; inserts tag-marked text + a space. */
export function createTagSuggestion({ getTags }: TagSuggestionOptions) {
  return createSuggestionExtension<string>({
    name: "tagSuggestion",
    char: "#",
    allowSpaces: false,
    items: (query) => {
      // Require at least one char after `#` so a bare `#` (or `# ` heading)
      // doesn't pop the tag menu and conflict with markdown headings.
      if (query.length === 0) {
        return [];
      }
      const q = query.toLowerCase();
      return getTags()
        .filter((tag) => tag.toLowerCase().includes(q))
        .slice(0, MAX_SUGGESTIONS);
    },
    command: ({ editor, range, props: tag }) => {
      editor
        .chain()
        .focus()
        .insertContentAt(range, [
          { type: "text", text: `#${tag}`, marks: [{ type: "tag", attrs: { tag } }] },
          { type: "text", text: " " },
        ])
        .run();
    },
    renderItem: (tag) =>
      createElement("span", { className: "truncate" }, createElement("span", { className: "text-muted-foreground mr-1" }, "#"), tag),
    getItemKey: (tag) => tag,
  });
}
