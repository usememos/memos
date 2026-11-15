import { commands, Editor } from "@usememos/editor";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildEditorExtensions } from "@/components/MemoEditor/edit/extensions";
import { memoResolveUrl } from "@/lib/memo-markdown";

const editors: Editor[] = [];

afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.replaceChildren();
});

function setup(content = "") {
  const root = document.createElement("div");
  document.body.append(root);
  const extensions = buildEditorExtensions({ getTags: () => [], onFiles: vi.fn(), emojiLabel: "Emoji" });
  const editor = new Editor({ element: root, content, resolveUrl: memoResolveUrl(), extensions });
  editors.push(editor);
  editor.focus();
  return { editor, root };
}

function paste(root: HTMLElement, text: string, plain = false) {
  if (plain) root.dispatchEvent(new KeyboardEvent("keydown", { key: "v", ctrlKey: true, metaKey: true, shiftKey: true, bubbles: true }));
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", {
    value: { files: [], types: ["text/plain"], getData: (type: string) => (type === "text/plain" ? text : "") },
  });
  root.dispatchEvent(event);
}

describe("memo editor link paste", () => {
  it("links a custom URI at the caret without losing punctuation", () => {
    const { root } = setup();
    paste(root, "obsidian://open?x=a)b]");
    expect(root.querySelector("a")?.getAttribute("href")).toBe("obsidian://open?x=a)b]");
  });

  it("links selected text", () => {
    const { root, editor } = setup("notes");
    editor.setSelection({ anchor: { block: 0, offset: 0 }, focus: { block: 0, offset: 5 } });
    paste(root, "slack://channel?team=T123");
    expect(root.querySelector("a")?.getAttribute("href")).toBe("slack://channel?team=T123");
    expect(root.textContent).toBe("notes");
  });

  it("keeps plain-text paste literal", () => {
    const { root } = setup();
    paste(root, "obsidian://open?vault=x", true);
    expect(root.querySelector("a")).toBeNull();
    expect(root.textContent).toBe("obsidian://open?vault=x");
  });

  it("replaces a code-to-prose selection on plain-text paste", () => {
    const { root, editor } = setup("```\nliteral\n```\n\nwords");
    editor.setSelection({ anchor: { block: 0, offset: 0 }, focus: { block: 1, offset: 5 } });
    paste(root, "obsidian://open?vault=x", true);
    expect(root.textContent).not.toContain("literal");
    expect(root.textContent).not.toContain("words");
    expect(root.querySelector("a")).toBeNull();
    expect(root.textContent).toContain("obsidian://open?vault=x");
  });

  it("keeps a code-block paste literal", () => {
    const { root, editor } = setup("```\nliteral\n```");
    editor.setSelection({ anchor: { block: 0, offset: 7 }, focus: { block: 0, offset: 7 } });
    paste(root, "obsidian://open?vault=x");
    expect(root.querySelector("a")).toBeNull();
    expect(root.textContent).toContain("literalobsidian://open?vault=x");
  });

  it.each(["https://example.com/", "obsidian://open?vault=notes"])("keeps %s literal inside inline code", (url) => {
    const { root, editor } = setup("`literal`");
    editor.setSelection({ anchor: { block: 0, offset: 3 }, focus: { block: 0, offset: 3 } });
    paste(root, url);
    expect(root.querySelector("a")).toBeNull();
    expect(root.querySelectorAll("code")).toHaveLength(1);
    expect(root.querySelector("code")?.textContent).toBe(`lit${url}eral`);
  });

  it("allows manually linking selected text to another app", () => {
    const { root, editor } = setup("notes");
    editor.setSelection({ anchor: { block: 0, offset: 0 }, focus: { block: 0, offset: 5 } });
    editor.run((state) => commands.setLink(state, "obsidian://open?vault=notes"));
    expect(root.querySelector("a")?.getAttribute("href")).toBe("obsidian://open?vault=notes");
    expect(root.textContent).toBe("notes");
  });

  it("drops dangerous link schemes", () => {
    const { root } = setup();
    paste(root, "javascript://alert(1)");
    expect(root.querySelector("a")).toBeNull();
  });
});
