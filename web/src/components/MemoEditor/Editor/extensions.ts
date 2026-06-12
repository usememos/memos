import type { AnyExtension } from "@tiptap/core";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Markdown } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import { preservedExtensions } from "./PreservedBlock";
import { Tag } from "./Tag";

/**
 * The canonical schema-relevant extension set, shared by the live editor and
 * the headless markdown codec so that parse/serialize behavior is identical
 * in both. UI-only extensions (Placeholder, suggestion popups) are added by
 * the editor component on top of this list and must never affect the schema.
 */
export function buildExtensions(): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      link: { openOnClick: false },
      // Markdown has no underline syntax; keeping the extension would let
      // Ctrl+U create marks that cannot serialize. Out of the schema entirely.
      underline: false,
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Markdown,
    ...preservedExtensions,
    Tag,
  ];
}
