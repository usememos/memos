import { Extension } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion from "@tiptap/suggestion";
import { createElement } from "react";
import { createSuggestionRenderer } from "./suggestionMenu";

export interface TagSuggestionOptions {
  /** Getter (not a snapshot) so the popup always sees freshly fetched tags. */
  getTags: () => string[];
}

const MAX_SUGGESTIONS = 20;

/** `#` popup backed by the user's existing tags; inserts tag-marked text + a space. */
export const TagSuggestion = Extension.create<TagSuggestionOptions>({
  name: "tagSuggestion",

  addOptions() {
    return { getTags: () => [] };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion<string>({
        editor: this.editor,
        pluginKey: new PluginKey("tagSuggestion"),
        char: "#",
        allowSpaces: false,
        items: ({ query }) => {
          // Require at least one char after `#` so a bare `#` (or `# ` heading)
          // doesn't pop the tag menu and conflict with markdown headings.
          if (query.length === 0) {
            return [];
          }
          const q = query.toLowerCase();
          return this.options
            .getTags()
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
        render: createSuggestionRenderer<string>({
          getItemKey: (tag) => tag,
          renderItem: (tag) =>
            createElement("span", { className: "truncate" }, createElement("span", { className: "text-muted-foreground mr-1" }, "#"), tag),
        }),
      }),
    ];
  },
});
