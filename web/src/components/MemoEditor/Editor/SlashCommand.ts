import { type Editor, Extension, type Range } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion from "@tiptap/suggestion";
import { createElement } from "react";
import { createSuggestionRenderer } from "./suggestionMenu";

export interface SlashCommandItem {
  name: string;
  apply: (editor: Editor, range: Range) => void;
}

// WYSIWYG counterparts of the raw editor's commands (Editor/commands.ts):
// the same four entries, realized as editor commands instead of raw strings.
export const slashCommandItems: SlashCommandItem[] = [
  {
    name: "todo",
    apply: (editor, range) => editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    name: "code",
    apply: (editor, range) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    name: "link",
    // After deleteRange + insertContent the marked text node "text" occupies
    // positions range.from..range.from+4. Select it so the user can overtype
    // the display text immediately — matching the textarea editor's cursorOffset=1.
    apply: (editor, range) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent("[text](url)", { contentType: "markdown" })
        .setTextSelection({ from: range.from, to: range.from + 4 })
        .run(),
  },
  {
    name: "table",
    // After insert the preservedBlock text starts at range.from. "| Header …"
    // has "| " (2 chars) before the first cell label, so range.from+2 lands on
    // the "H" of "Header" — matching the textarea editor's first-header-cell
    // cursor placement.
    apply: (editor, range) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent("| Header | Header |\n| ------ | ------ |\n| Cell   | Cell |", { contentType: "markdown" })
        .setTextSelection(range.from + 2)
        .run(),
  },
];

/**
 * Returns the subset of slash commands whose name starts with `query`
 * (case-insensitive). Returns the full list when `query` is empty.
 */
export function filterSlashCommands(query: string): SlashCommandItem[] {
  const q = query.toLowerCase();
  return q ? slashCommandItems.filter((item) => item.name.startsWith(q)) : slashCommandItems;
}

/** `/` command popup; replaces the raw editor's SlashCommands in WYSIWYG mode. */
export const SlashCommand = Extension.create({
  name: "slashCommand",

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashCommandItem>({
        editor: this.editor,
        pluginKey: new PluginKey("slashCommand"),
        char: "/",
        allowSpaces: false,
        items: ({ query }) => filterSlashCommands(query),
        command: ({ editor, range, props: item }) => {
          item.apply(editor, range);
        },
        render: createSuggestionRenderer<SlashCommandItem>({
          getItemKey: (item) => item.name,
          renderItem: (item) =>
            createElement(
              "span",
              { className: "tracking-wide" },
              createElement("span", { className: "text-muted-foreground" }, "/"),
              item.name,
            ),
        }),
      }),
    ];
  },
});
