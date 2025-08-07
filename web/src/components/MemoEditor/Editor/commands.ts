import { Command } from "@/components/MemoEditor/types/command";

export const editorCommands: Command[] = [
  {
    name: "todo",
    description: "Insert a task checkbox",
    run: () => "- [ ] ",
    cursorOffset: 6,
  },
  {
    name: "code",
    description: "Insert a code block",
    run: () => "```\n\n```",
    cursorOffset: 4,
  },
  {
    name: "link",
    description: "Insert a link",
    run: () => "[text](url)",
    cursorOffset: 1,
  },
  {
    name: "table",
    description: "Insert a table",
    run: () => "| Header | Header |\n| ------ | ------ |\n| Cell   | Cell |",
    cursorOffset: 1,
  },
  {
    name: "highlight",
    description: "Insert highlighted text",
    run: () => "==text==",
    cursorOffset: 2,
  },
];
