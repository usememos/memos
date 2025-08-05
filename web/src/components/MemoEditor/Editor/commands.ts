import { Command } from "@/components/MemoEditor/types/command";

export const editorCommands: Command[] = [
  {
    name: "todo",
    description: "Insert a task checkbox",
    run: () => "- [ ] ",
  },
  {
    name: "code",
    description: "Insert a code block",
    run: () => "```\n\n```",
  },
];
