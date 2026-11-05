import { type Block, type Doc, listItem, paragraph, quote } from "@usememos/editor";
import { describe, expect, it } from "vitest";
import { hiddenCompletedTaskIds } from "@/components/MemoEditor/view/taskVisibility";

const doc = (...blocks: Block[]): Doc => ({ blocks });

describe("hiddenCompletedTaskIds", () => {
  it("hides completed tasks and leaves open ones visible", () => {
    const open = listItem("task", [], { checked: false });
    const done = listItem("task", [], { checked: true });
    expect(hiddenCompletedTaskIds(doc(open, done))).toEqual(new Set([done.id]));
  });

  it("keeps a completed parent whose nested task is still open", () => {
    const parent = listItem("task", [], { checked: true });
    const openChild = listItem("task", [], { checked: false, indent: 1 });
    const doneChild = listItem("task", [], { checked: true, indent: 1 });
    const doneSibling = listItem("task", [], { checked: true });
    expect(hiddenCompletedTaskIds(doc(parent, openChild, doneChild, doneSibling))).toEqual(new Set([doneChild.id, doneSibling.id]));
  });

  it("hides a completed list whose nested tasks are all completed", () => {
    const parent = listItem("task", [], { checked: true });
    const child = listItem("task", [], { checked: true, indent: 1 });
    expect(hiddenCompletedTaskIds(doc(parent, child))).toEqual(new Set([parent.id, child.id]));
  });

  it("keeps a completed task above nested non-task content as its context", () => {
    const parent = listItem("task", [], { checked: true });
    const bullet = listItem("bullet", [], { indent: 1 });
    const doneSibling = listItem("task", [], { checked: true });
    expect(hiddenCompletedTaskIds(doc(parent, bullet, doneSibling))).toEqual(new Set([doneSibling.id]));
  });

  it("does not treat a following paragraph or another quote as nesting", () => {
    const quoted = listItem("task", [], { checked: true, quote: "quote" });
    const plain = listItem("task", [], { checked: true, indent: 1 });
    const done = listItem("task", [], { checked: true });
    expect(hiddenCompletedTaskIds(doc(quoted, plain, paragraph(), done))).toEqual(new Set([quoted.id, plain.id, done.id]));
    expect(hiddenCompletedTaskIds(doc(quoted, quote()))).toEqual(new Set([quoted.id]));
  });
});
