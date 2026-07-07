import {
  BoldIcon,
  CodeIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  ListTodoIcon,
  type LucideIcon,
  SquareCodeIcon,
  StrikethroughIcon,
} from "lucide-react";
import type { Translations } from "@/utils/i18n";

/**
 * Backend-agnostic catalog of the editor's formatting verbs — metadata only, no
 * dependency on the concrete editor. Every surface that needs the verbs — the
 * focus-mode toolbar, the active-state hook, and any future `/` slash menu —
 * derives its labels, icons, and grouping from this catalog instead of
 * re-declaring them. How a verb is applied to the live editor is supplied
 * separately (Editor/formatting.ts).
 *
 * To add a formatting verb, add one entry here (and, if it's a new mark/list,
 * its field on ActiveFormatState); the toolbar and active-state pick it up.
 */

export type ToolbarHeadingLevel = 1 | 2 | 3;

/** Clamp a raw heading depth to the toolbar's addressable levels (H4–H6 → null). */
export function toToolbarHeadingLevel(level: number): ToolbarHeadingLevel | null {
  return level === 1 || level === 2 || level === 3 ? level : null;
}

export type EditorCommandId =
  | "bold"
  | "italic"
  | "strikethrough"
  | "code"
  | "codeBlock"
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
  strikethrough: boolean;
  code: boolean;
  codeBlock: boolean;
  bulletList: boolean;
  orderedList: boolean;
  taskList: boolean;
  link: boolean;
  headingLevel: ToolbarHeadingLevel | null;
}

export const EMPTY_ACTIVE_FORMATS: ActiveFormatState = {
  bold: false,
  italic: false,
  strikethrough: false,
  code: false,
  codeBlock: false,
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

/** Toolbar grouping — the toolbar builds each group by filtering on this.
 *  `mark` = inline formatting, `block` = line/block-level (lists, code block). */
export type EditorCommandGroup = "mark" | "block" | "heading" | "link";

export interface EditorCommand {
  id: EditorCommandId;
  /** i18n key for label / tooltip / aria-label. */
  labelKey: Translations;
  /** Button icon. Omitted for headings/paragraph, which render as label-only dropdown items. */
  icon?: LucideIcon;
  group: EditorCommandGroup;
}

export const EDITOR_COMMANDS: EditorCommand[] = [
  {
    id: "bold",
    labelKey: "editor.format.bold",
    icon: BoldIcon,
    group: "mark",
  },
  {
    id: "italic",
    labelKey: "editor.format.italic",
    icon: ItalicIcon,
    group: "mark",
  },
  {
    id: "strikethrough",
    labelKey: "editor.format.strikethrough",
    icon: StrikethroughIcon,
    group: "mark",
  },
  {
    id: "code",
    labelKey: "editor.format.code",
    icon: CodeIcon,
    group: "mark",
  },
  {
    id: "bulletList",
    labelKey: "editor.format.bullet-list",
    icon: ListIcon,
    group: "block",
  },
  {
    id: "orderedList",
    labelKey: "editor.format.ordered-list",
    icon: ListOrderedIcon,
    group: "block",
  },
  {
    id: "taskList",
    labelKey: "editor.format.task-list",
    icon: ListTodoIcon,
    group: "block",
  },
  {
    id: "codeBlock",
    labelKey: "editor.format.code-block",
    icon: SquareCodeIcon,
    group: "block",
  },
  {
    id: "paragraph",
    labelKey: "editor.format.paragraph",
    group: "heading",
  },
  {
    id: "heading1",
    labelKey: "editor.format.heading-1",
    group: "heading",
  },
  {
    id: "heading2",
    labelKey: "editor.format.heading-2",
    group: "heading",
  },
  {
    id: "heading3",
    labelKey: "editor.format.heading-3",
    group: "heading",
  },
  {
    id: "link",
    labelKey: "editor.format.link",
    icon: LinkIcon,
    group: "link",
  },
];

export const EDITOR_COMMANDS_BY_ID = Object.fromEntries(EDITOR_COMMANDS.map((command) => [command.id, command])) as Record<
  EditorCommandId,
  EditorCommand
>;

/** Whether a given command is active for an active-format snapshot. Lets any
 *  surface (toolbar, slash menu) highlight commands by reading the backend-
 *  agnostic ActiveFormatState — no live-editor dependency. */
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
    // The remaining ids (marks, blocks, link) map 1:1 to the snapshot.
    default:
      return active[id];
  }
}
