export interface Command {
  name: string;
  /** Returns text to insert. Ignored if `action` is set. */
  run: () => string;
  cursorOffset?: number;
  /** If set, called instead of inserting run() text. Used for dialog-based commands. */
  action?: () => void;
}

export const editorCommands: Command[] = [
  {
    name: "todo",
    run: () => "- [ ] ",
    cursorOffset: 6,
  },
  {
    name: "code",
    run: () => "```\n\n```",
    cursorOffset: 4,
  },
  {
    name: "link",
    run: () => "[text](url)",
    cursorOffset: 1,
  },
  {
    name: "table",
    run: () => "| Header | Header |\n| ------ | ------ |\n| Cell   | Cell |",
    cursorOffset: 1,
  },
];

/**
 * Create the full editor commands list, with the table command
 * wired to open the table editor dialog instead of inserting raw markdown.
 */
export function createEditorCommands(onOpenTableEditor?: () => void): Command[] {
  if (!onOpenTableEditor) return editorCommands;

  return editorCommands.map((cmd) => {
    if (cmd.name === "table") {
      return { ...cmd, action: onOpenTableEditor };
    }
    return cmd;
  });
}
