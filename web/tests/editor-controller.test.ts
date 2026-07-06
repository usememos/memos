import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { describe, expect, it } from "vitest";
import { createController } from "@/components/MemoEditor/Editor/controller";

function view(doc = "") {
  return new EditorView({ state: EditorState.create({ doc }) });
}

describe("source editor controller", () => {
  it("round-trips markdown verbatim, including previously-lossy inputs", () => {
    const v = view();
    const c = createController(v, {} as never);
    for (const md of ["![a](x.png)", "Title\n===", "1. a\n  1. b\n    1. c", "a&nbsp;b"]) {
      c.setMarkdown(md);
      expect(c.getMarkdown()).toBe(md);
    }
  });

  it("reports emptiness on whitespace", () => {
    const c = createController(view("   \n  "), {} as never);
    expect(c.isEmpty()).toBe(true);
  });

  it("inserts markdown as its own block", () => {
    const v = view("alpha");
    const c = createController(v, {} as never);
    v.dispatch({ selection: { anchor: 5 } });
    c.insertMarkdown("beta");
    expect(c.getMarkdown()).toBe("alpha\n\nbeta");
  });
});
