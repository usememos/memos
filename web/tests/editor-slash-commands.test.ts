import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { buildExtensions } from "@/components/MemoEditor/Editor/extensions";
import { filterSlashCommands, slashCommandItems } from "@/components/MemoEditor/Editor/SlashCommand";

let editor: Editor;

function applyCommand(name: string, content = "") {
  editor = new Editor({ extensions: buildExtensions(), content, contentType: "markdown" });
  const item = slashCommandItems.find((candidate) => candidate.name === name);
  if (!item) throw new Error(`unknown slash command: ${name}`);
  // Simulate a trigger at the end of an empty paragraph (the only case this
  // range math is correct for). After inserting "/" into an empty paragraph,
  // the doc is doc(paragraph(text"/")), with the slash at positions 1..2
  // (doc.content.size = 3). We replicate that range so deleteRange removes the
  // trigger character exactly as the real Suggestion plugin would.
  editor.commands.insertContent("/");
  const end = editor.state.doc.content.size;
  item.apply(editor, { from: end - 2, to: end - 1 });
  return editor.getMarkdown();
}

afterEach(() => editor?.destroy());

describe("WYSIWYG slash commands", () => {
  it("todo converts the block into a task list", () => {
    expect(applyCommand("todo").trimEnd()).toBe("- [ ]");
  });

  it("code converts the block into a code block", () => {
    expect(applyCommand("code")).toContain("```");
  });

  it("link inserts a markdown link", () => {
    expect(applyCommand("link")).toContain("[text](url)");
  });

  it("link places cursor selecting the display text", () => {
    // After deleteRange(from:1, to:2) + insertContent the marked text node
    // "text" occupies positions 1..5 (range.from=1, text length=4).
    // The command chains .setTextSelection({ from: 1, to: 5 }) so the user
    // can immediately overtype the placeholder label.
    applyCommand("link");
    const sel = editor.state.selection;
    expect(sel.from).toBe(1);
    expect(sel.to).toBe(5);
  });

  it("table inserts a preserved markdown table", () => {
    const markdown = applyCommand("table");
    expect(markdown).toContain("| Header | Header |");
    expect(markdown).toContain("| ------ | ------ |");
  });

  it("table places cursor at the first header cell", () => {
    // The preservedBlock text starts at range.from (pos 1). "| Header …" has
    // "| " (2 chars) before the first label, so the command chains
    // .setTextSelection(range.from + 2) = position 3, landing on the "H".
    applyCommand("table");
    const sel = editor.state.selection;
    expect(sel.from).toBe(3);
    expect(sel.to).toBe(3);
  });
});

describe("filterSlashCommands", () => {
  it("returns all items for an empty query", () => {
    expect(filterSlashCommands("").map((i) => i.name)).toEqual(["todo", "code", "link", "table"]);
  });

  it("filters items by case-insensitive prefix", () => {
    expect(filterSlashCommands("t").map((i) => i.name)).toEqual(["todo", "table"]);
    expect(filterSlashCommands("T").map((i) => i.name)).toEqual(["todo", "table"]);
    expect(filterSlashCommands("c").map((i) => i.name)).toEqual(["code"]);
  });

  it("returns an empty array for a non-matching query", () => {
    expect(filterSlashCommands("x")).toEqual([]);
  });
});
