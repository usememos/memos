import type { Editor } from "@tiptap/core";
import { BoldIcon, CodeIcon, ItalicIcon, LinkIcon, ListIcon, ListOrderedIcon, ListTodoIcon, type LucideIcon } from "lucide-react";
import type { Translations } from "@/utils/i18n";

/**
 * The single source of truth for the editor's formatting verbs. Every surface
 * that needs them — the focus-mode toolbar, the active-state hook, and any
 * future `/` slash menu — derives from this catalog instead of re-declaring the
 * verb, its icon, and its command in its own file. Commands act directly on the
 * live Tiptap editor (the only place that holds it).
 *
 * To add a formatting verb, add one entry here (and, if it's a new mark/list,
 * its field on ActiveFormatState); the toolbar and active-state pick it up.
 */

export type ToolbarHeadingLevel = 1 | 2 | 3;

export type EditorCommandId =
  | "bold"
  | "italic"
  | "code"
  | "bulletList"
  | "orderedList"
  | "taskList"
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "link";

/** Which marks/blocks are active at the current selection (toolbar highlighting). */
export interface ActiveFormatState {
  bold: boolean;
  italic: boolean;
  code: boolean;
  bulletList: boolean;
  orderedList: boolean;
  taskList: boolean;
  link: boolean;
  headingLevel: ToolbarHeadingLevel | null;
}

export const EMPTY_ACTIVE_FORMATS: ActiveFormatState = {
  bold: false,
  italic: false,
  code: false,
  bulletList: false,
  orderedList: false,
  taskList: false,
  link: false,
  headingLevel: null,
};

export interface EditorCommandContext {
  /** Link target, read by the `link` command when adding a link. */
  url?: string;
}

/** Toolbar grouping — the toolbar builds each group by filtering on this. */
export type EditorCommandGroup = "mark" | "list" | "heading" | "link";

export interface EditorCommand {
  id: EditorCommandId;
  /** i18n key for label / tooltip / aria-label. */
  labelKey: Translations;
  /** Button icon. Omitted for headings/paragraph, which render as label-only dropdown items. */
  icon?: LucideIcon;
  group: EditorCommandGroup;
  /** Apply to the live editor. The `link` command reads `ctx.url`. */
  run: (editor: Editor, ctx?: EditorCommandContext) => void;
}

export const EDITOR_COMMANDS: EditorCommand[] = [
  {
    id: "bold",
    labelKey: "editor.format.bold",
    icon: BoldIcon,
    group: "mark",
    run: (editor) => editor.chain().focus().toggleBold().run(),
  },
  {
    id: "italic",
    labelKey: "editor.format.italic",
    icon: ItalicIcon,
    group: "mark",
    run: (editor) => editor.chain().focus().toggleItalic().run(),
  },
  {
    id: "code",
    labelKey: "editor.format.code",
    icon: CodeIcon,
    group: "mark",
    run: (editor) => editor.chain().focus().toggleCode().run(),
  },
  {
    id: "bulletList",
    labelKey: "editor.format.bullet-list",
    icon: ListIcon,
    group: "list",
    run: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    id: "orderedList",
    labelKey: "editor.format.ordered-list",
    icon: ListOrderedIcon,
    group: "list",
    run: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    id: "taskList",
    labelKey: "editor.format.task-list",
    icon: ListTodoIcon,
    group: "list",
    run: (editor) => editor.chain().focus().toggleTaskList().run(),
  },
  {
    id: "paragraph",
    labelKey: "editor.format.paragraph",
    group: "heading",
    run: (editor) => editor.chain().focus().setParagraph().run(),
  },
  {
    id: "heading1",
    labelKey: "editor.format.heading-1",
    group: "heading",
    run: (editor) => editor.chain().focus().setHeading({ level: 1 }).run(),
  },
  {
    id: "heading2",
    labelKey: "editor.format.heading-2",
    group: "heading",
    run: (editor) => editor.chain().focus().setHeading({ level: 2 }).run(),
  },
  {
    id: "heading3",
    labelKey: "editor.format.heading-3",
    group: "heading",
    run: (editor) => editor.chain().focus().setHeading({ level: 3 }).run(),
  },
  {
    id: "link",
    labelKey: "editor.format.link",
    icon: LinkIcon,
    group: "link",
    run: (editor, ctx) => {
      if (editor.isActive("link")) {
        editor.chain().focus().unsetLink().run();
        return;
      }
      const href = ctx?.url?.trim();
      if (!href) {
        return;
      }
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    },
  },
];

export const EDITOR_COMMANDS_BY_ID = Object.fromEntries(EDITOR_COMMANDS.map((command) => [command.id, command])) as Record<
  EditorCommandId,
  EditorCommand
>;

const HEADING_LEVELS: ToolbarHeadingLevel[] = [1, 2, 3];

/** Derive the full active-format snapshot from the live editor in one pass. */
export function getActiveFormats(editor: Editor): ActiveFormatState {
  const headingLevel = HEADING_LEVELS.find((level) => editor.isActive("heading", { level })) ?? null;
  return {
    bold: editor.isActive("bold"),
    italic: editor.isActive("italic"),
    code: editor.isActive("code"),
    bulletList: editor.isActive("bulletList"),
    orderedList: editor.isActive("orderedList"),
    taskList: editor.isActive("taskList"),
    link: editor.isActive("link"),
    headingLevel,
  };
}

/** Whether a given command is active for an active-format snapshot. Lets any
 *  surface (toolbar, slash menu) highlight commands without re-deriving state. */
export function isCommandActive(active: ActiveFormatState, id: EditorCommandId): boolean {
  switch (id) {
    case "paragraph":
      return active.headingLevel === null;
    case "heading1":
      return active.headingLevel === 1;
    case "heading2":
      return active.headingLevel === 2;
    case "heading3":
      return active.headingLevel === 3;
    // bold/italic/code/bulletList/orderedList/taskList/link map 1:1 to the snapshot.
    default:
      return active[id];
  }
}
