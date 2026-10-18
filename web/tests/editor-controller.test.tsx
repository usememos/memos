import { render } from "@testing-library/react";
import type { EditorMode } from "@usememos/editor";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import Editor from "@/components/MemoEditor/edit/Editor";
import type { EditorController } from "@/components/MemoEditor/edit/types/editorController";
import type { UploadAnchorDescriptor } from "@/components/MemoEditor/edit/uploadAnchors";

vi.mock("@/hooks/useUserQueries", () => ({
  useTagCounts: () => ({ data: {} }),
  useUsersByUsernames: () => ({ data: undefined }),
  userDetailQueryOptions: () => ({}),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ userTagsSetting: undefined }) }));

function setup(value = "", mode: EditorMode = "rich") {
  const ref = createRef<EditorController>();
  const onContentChange = vi.fn();
  const utils = render(
    <Editor
      ref={ref}
      className="x"
      value={value}
      placeholder="memo"
      mode={mode}
      onContentChange={onContentChange}
      onFiles={vi.fn()}
      onSubmit={vi.fn()}
    />,
  );
  return { ...utils, c: ref.current as EditorController, onContentChange };
}

/** Puts the caret at the end of block `block`. */
function caretAtEnd(c: EditorController, block: number, offset: number) {
  c.setSelection({ anchor: { block, offset }, focus: { block, offset } });
}

const descriptor = (id: string, overrides: Partial<UploadAnchorDescriptor> = {}): UploadAnchorDescriptor => ({
  id,
  status: "uploading",
  completed: 0,
  total: 1,
  message: "Uploading images 0/1",
  retryLabel: "Retry",
  keepLabel: "Cancel",
  ...overrides,
});

describe("editor controller", () => {
  it("round-trips markdown verbatim", () => {
    const { c } = setup();
    for (const md of ["![a](x.png)", "Title\n===", "1. a\n  1. b\n    1. c", "a&nbsp;b", "# Title\n\n- a\n  1. b"]) {
      c.setMarkdown(md);
      expect(c.getMarkdown()).toBe(md);
    }
  });

  it("reports emptiness on whitespace", () => {
    const { c } = setup("   ");
    expect(c.isEmpty()).toBe(true);
  });

  it("inserts markdown after the caret's block, keeping the text", () => {
    const { c } = setup("alpha");
    caretAtEnd(c, 0, 5);
    c.insertMarkdown("beta");
    expect(c.getMarkdown()).toBe("alpha\n\nbeta");
  });

  it("inserts markdown in place of an empty paragraph", () => {
    const { c } = setup("");
    c.insertMarkdown("![photo](/file/attachments/photo)");
    // The caret stays in an empty paragraph below the image.
    expect(c.getMarkdown().trimEnd()).toBe("![photo](/file/attachments/photo)");
  });

  it("captures and restores the selection as JSON", () => {
    const { c } = setup("alpha beta");
    caretAtEnd(c, 0, 7);
    expect(c.getSelection()).toEqual({ anchor: { block: 0, offset: 7 }, focus: { block: 0, offset: 7 } });
    caretAtEnd(c, 0, 99);
    expect(c.getSelection()?.focus.offset).toBe(10);
  });
});

describe("suggested tag insertion", () => {
  it.each([
    ["alpha beta", 0, "#work alpha beta"],
    ["alpha beta", 6, "alpha #work beta"],
    ["alphabeta", 5, "alpha #work beta"],
    // A space that ends a paragraph is not saved.
    ["alpha beta", 10, "alpha beta #work"],
  ])("inserts inline into %s at %i with natural spacing", (doc, offset, expected) => {
    const { c } = setup(doc);
    caretAtEnd(c, 0, offset);
    expect(c.insertTag("work")).toBe(true);
    expect(c.getMarkdown()).toBe(expected);
    expect(c.getTags()).toEqual(["work"]);
  });

  it("recognizes actual tags, excluding code, links, URLs, escapes, and nested parent names", () => {
    const { c } = setup("`#work` [#work](/url) https://example.com/#work \\#work\n\n#work/project");
    expect(c.getTags()).toEqual(["work/project"]);
    caretAtEnd(c, 1, "#work/project".length);
    expect(c.insertTag("work")).toBe(true);
    expect(c.insertTag("work")).toBe(false);
    expect(c.insertTag("two words")).toBe(false);
    expect(c.getTags()).toEqual(["work/project", "work"]);
  });
});

describe("checklist detection", () => {
  it.each([
    ["- [ ] Task", true],
    ["- [X] Done", true],
    ["- Parent\n  - [ ] Nested", true],
    ["Note\n\n- [x] Done", true],
    ["```\n- [ ] Example\n```", false],
    ["`- [ ] Example`", false],
    ["    - [ ] Indented code", false],
    ["\\- [ ] Escaped", false],
    ["<pre>\n- [ ] HTML\n</pre>", false],
    ["- Plain list", false],
  ])("recognizes tasks in %s", (doc, expected) => {
    const { c } = setup(doc);
    expect(c.hasChecklist()).toBe(expected);
  });
});

describe("upload anchors", () => {
  it("shows an anchor after the caret's block and resolves it into an image block", () => {
    const { c, container } = setup("alpha");
    caretAtEnd(c, 0, 5);
    c.createUploadAnchor(descriptor("upload-one"));
    expect(container.querySelector(".memo-upload-anchor")).toHaveTextContent("Uploading images 0/1");
    expect(c.getMarkdown()).toBe("alpha");

    c.resolveUploadAnchor("upload-one", "![photo](/file/attachments/photo)");
    expect(c.getMarkdown()).toBe("alpha\n\n![photo](/file/attachments/photo)");
    expect(container.querySelector(".memo-upload-anchor")).toBeNull();
  });

  it("cancels an anchor without touching the document", () => {
    const { c, container } = setup("alpha");
    c.createUploadAnchor(descriptor("upload-two"));
    c.cancelUploadAnchor("upload-two");
    expect(container.querySelector(".memo-upload-anchor")).toBeNull();
    expect(c.getMarkdown()).toBe("alpha");
  });

  it("rewires failure actions when the anchor updates", () => {
    const { c, container } = setup("alpha");
    const stale = vi.fn();
    const fresh = vi.fn();
    c.createUploadAnchor(descriptor("upload-three", { status: "failed", onRetry: stale }));
    c.updateUploadAnchor(descriptor("upload-three", { status: "failed", message: "Retrying soon", onRetry: fresh }));

    expect(container.querySelector(".memo-upload-anchor")).toHaveTextContent("Retrying soon");
    container.querySelector<HTMLButtonElement>(".memo-upload-anchor-action")?.click();
    expect(fresh).toHaveBeenCalledTimes(1);
    expect(stale).not.toHaveBeenCalled();
  });
});

describe("source mode", () => {
  const memo = "# Plan\n\n- [ ] Ship #work\n\n`#code`";

  it("reads tags and tasks from the Markdown text", () => {
    const { c } = setup(memo, "source");
    expect(c.getTags()).toEqual(["work"]);
    expect(c.hasChecklist()).toBe(true);
  });

  it("does not insert a tag the text already has", () => {
    const { c } = setup(memo, "source");
    caretAtEnd(c, 0, "# Plan".length);
    expect(c.insertTag("work")).toBe(false);
    expect(c.insertTag("home")).toBe(true);
    // Plain text keeps the space after the tag; rich mode drops it at a paragraph's end.
    expect(c.getMarkdown()).toBe("# Plan #home \n\n- [ ] Ship #work\n\n`#code`");
  });

  it("inserts Markdown on lines of its own after the caret's line", () => {
    const { c } = setup(memo, "source");
    caretAtEnd(c, 0, "# Plan".length);
    c.insertMarkdown("![photo](a.png)");
    expect(c.getMarkdown()).toBe("# Plan\n![photo](a.png)\n\n- [ ] Ship #work\n\n`#code`");
  });

  it("shows the memo as Markdown text, the same document rich mode saves", () => {
    const { c, container } = setup(memo, "source");
    expect(container.querySelector(".mbe-source")?.textContent).toBe(memo);
    expect(c.getMarkdown()).toBe(memo);
  });
});
