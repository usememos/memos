export interface Command {
  name: string;
  run: () => string;
  cursorOffset?: number;
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
