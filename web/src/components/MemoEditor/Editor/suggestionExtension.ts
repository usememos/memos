import { Extension } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";
import type { ReactNode } from "react";
import { createSuggestionRenderer } from "./suggestionMenu";

/**
 * Everything a single `@tiptap/suggestion` trigger needs, minus the boilerplate
 * (the Extension wrapper, the PluginKey, and the React popup renderer). Each
 * trigger — `#` tags today, `/` commands or `@` mentions tomorrow — is now a
 * small config object instead of a hand-wired extension.
 */
export interface SuggestionExtensionConfig<T> {
  /** Unique extension + plugin-key name, e.g. "tagSuggestion". */
  name: string;
  /** The character that opens the popup, e.g. "#" or "/". */
  char: string;
  /** Whether a space inside the query keeps the popup open. Defaults to false. */
  allowSpaces?: boolean;
  /** Resolve the items to show for the current query (already stripped of `char`). */
  items: (query: string) => T[];
  /** Apply the chosen item to the document. */
  command: SuggestionOptions<T, T>["command"];
  /** Render a single item row. */
  renderItem: (item: T, isSelected: boolean) => ReactNode;
  /** Stable React key for an item. */
  getItemKey: (item: T) => string;
}

/**
 * Build a Tiptap extension that shows the shared suggestion popup when `char`
 * is typed. Mirrors the original hand-written TagSuggestion exactly; it just
 * factors out the parts every trigger repeats so adding another is ~10 lines.
 */
export function createSuggestionExtension<T>(config: SuggestionExtensionConfig<T>): Extension {
  return Extension.create({
    name: config.name,

    addProseMirrorPlugins() {
      return [
        Suggestion<T, T>({
          editor: this.editor,
          pluginKey: new PluginKey(config.name),
          char: config.char,
          allowSpaces: config.allowSpaces ?? false,
          items: ({ query }) => config.items(query),
          command: config.command,
          render: createSuggestionRenderer<T>({
            renderItem: config.renderItem,
            getItemKey: config.getItemKey,
          }),
        }),
      ];
    },
  });
}
