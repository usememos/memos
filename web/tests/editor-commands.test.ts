import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { EDITOR_COMMANDS, EDITOR_COMMANDS_BY_ID, getActiveFormats } from "@/components/MemoEditor/Editor/editorCommands";
import { buildExtensions } from "@/components/MemoEditor/Editor/extensions";

function makeEditor(content = "") {
  return new Editor({ extensions: buildExtensions(), content, contentType: "markdown" });
}

describe("editor command catalog", () => {
  it("exposes every command keyed by id", () => {
    for (const command of EDITOR_COMMANDS) {
      expect(EDITOR_COMMANDS_BY_ID[command.id]).toBe(command);
    }
  });

  it("bold command toggles the bold mark, reflected by getActiveFormats", () => {
    const editor = makeEditor("hello");
    try {
      editor.commands.selectAll();
      expect(getActiveFormats(editor).bold).toBe(false);
      EDITOR_COMMANDS_BY_ID.bold.run(editor);
      expect(getActiveFormats(editor).bold).toBe(true);
    } finally {
      editor.destroy();
    }
  });

  it("heading2 command sets the level, reported by getActiveFormats.headingLevel", () => {
    const editor = makeEditor("title");
    try {
      expect(getActiveFormats(editor).headingLevel).toBeNull();
      EDITOR_COMMANDS_BY_ID.heading2.run(editor);
      expect(getActiveFormats(editor).headingLevel).toBe(2);
      EDITOR_COMMANDS_BY_ID.paragraph.run(editor);
      expect(getActiveFormats(editor).headingLevel).toBeNull();
    } finally {
      editor.destroy();
    }
  });

  it("taskList command toggles a task list", () => {
    const editor = makeEditor("buy milk");
    try {
      EDITOR_COMMANDS_BY_ID.taskList.run(editor);
      expect(getActiveFormats(editor).taskList).toBe(true);
    } finally {
      editor.destroy();
    }
  });

  it("link command applies a link from ctx.url and clears it when already active", () => {
    const editor = makeEditor("memos");
    try {
      editor.commands.selectAll();
      EDITOR_COMMANDS_BY_ID.link.run(editor, { url: "https://usememos.com" });
      expect(getActiveFormats(editor).link).toBe(true);
      editor.commands.selectAll();
      EDITOR_COMMANDS_BY_ID.link.run(editor); // active → unset (ignores missing url)
      expect(getActiveFormats(editor).link).toBe(false);
    } finally {
      editor.destroy();
    }
  });
});
