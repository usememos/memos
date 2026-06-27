import { type AnyExtension, mergeAttributes } from "@tiptap/core";
import { Heading } from "@tiptap/extension-heading";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import StarterKit from "@tiptap/starter-kit";
import { type HeadingLevel, headingClass, markdownStyles } from "@/lib/markdownStyles";
import { Mention } from "./Mention";
import { preservedExtensions } from "./PreservedBlock";
import { Tag } from "./Tag";
import { TagAwareMarkdown } from "./tagMarkdown";

/**
 * StarterKit's Heading is bundled and cannot vary classes by level via static
 * HTMLAttributes, so we disable it (heading: false) and render headings here.
 * renderHTML only affects the editable DOM — heading markdown serialization is
 * unchanged — so the round-trip codec is unaffected.
 */
const StyledHeading = Heading.extend({
  renderHTML({ node, HTMLAttributes }) {
    const { levels } = this.options;
    const level = (levels.includes(node.attrs.level) ? node.attrs.level : levels[0]) as HeadingLevel;
    return [`h${level}`, mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { class: headingClass(level) }), 0];
  },
});

/**
 * The canonical schema-relevant extension set, shared by the live editor and
 * the headless markdown codec so that parse/serialize behavior is identical
 * in both. UI-only extensions (Placeholder, suggestion popups) are added by
 * the editor component on top of this list and must never affect the schema.
 */
export function buildExtensions(): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: false,
      link: { openOnClick: false, HTMLAttributes: { class: markdownStyles.link } },
      // Markdown has no underline syntax; keeping the extension would let
      // Ctrl+U create marks that cannot serialize. Out of the schema entirely.
      underline: false,
      paragraph: { HTMLAttributes: { class: markdownStyles.paragraph } },
      blockquote: { HTMLAttributes: { class: markdownStyles.blockquote } },
      bulletList: { HTMLAttributes: { class: markdownStyles.bulletList } },
      orderedList: { HTMLAttributes: { class: markdownStyles.orderedList } },
      listItem: { HTMLAttributes: { class: markdownStyles.listItem } },
      code: { HTMLAttributes: { class: markdownStyles.inlineCode } },
      horizontalRule: { HTMLAttributes: { class: markdownStyles.horizontalRule } },
    }),
    StyledHeading.configure({ levels: [1, 2, 3, 4, 5, 6] }),
    TaskList,
    TaskItem.configure({ nested: true }),
    TagAwareMarkdown,
    ...preservedExtensions,
    Tag,
    Mention,
  ];
}
