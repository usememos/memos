import { Command } from "@/components/MemoEditor/types/command";

export const editorCommands: Command[] = [
  {
    name: "todo",
    run: () => "- [ ] ",
    cursorOffset: 6, // Places cursor after "- [ ] " to start typing task
  },
  {
    name: "code",
    run: () => "```\n\n```",
    cursorOffset: 4, // Places cursor on empty line between code fences
  },
  {
    name: "link",
    run: () => "[text](url)",
    cursorOffset: 1, // Places cursor after "[" to type link text
  },
  {
    name: "table",
    run: () => "| Header | Header |\n| ------ | ------ |\n| Cell   | Cell |",
    cursorOffset: 1, // Places cursor after first "|" to edit first header
  },
  {
    name: "highlight",
    run: () => "==text==",
    cursorOffset: 2, // Places cursor between "==" markers to type highlighted text
  },
];
