import { describe, expect, it } from "vitest";
import { checkAllTasks, removeCompletedTasks, uncheckAllTasks } from "@/utils/markdown-task-actions";

describe("checkAllTasks", () => {
  it("checks every unchecked task while preserving source formatting", () => {
    const markdown = ["Intro", "- [ ] first", "* [x] second", "  + [ ] nested", "1. [ ] ordered", "Outro"].join("\n");

    expect(checkAllTasks(markdown)).toBe(["Intro", "- [x] first", "* [x] second", "  + [x] nested", "1. [x] ordered", "Outro"].join("\n"));
  });

  it("returns the original string when no checkbox markers need changing", () => {
    const markdown = ["Intro", "- [x] first", "Outro"].join("\n");

    expect(checkAllTasks(markdown)).toBe(markdown);
  });
});

describe("uncheckAllTasks", () => {
  it("unchecks every checked task while preserving source formatting", () => {
    const markdown = ["Intro", "- [x] first", "* [X] second", "  + [ ] nested", "1. [x] ordered", "Outro"].join("\n");

    expect(uncheckAllTasks(markdown)).toBe(
      ["Intro", "- [ ] first", "* [ ] second", "  + [ ] nested", "1. [ ] ordered", "Outro"].join("\n"),
    );
  });

  it("returns the original string when no checkbox markers need changing", () => {
    const markdown = ["Intro", "- [ ] first", "Outro"].join("\n");

    expect(uncheckAllTasks(markdown)).toBe(markdown);
  });

  it("ignores task-looking text inside fenced and inline code", () => {
    const markdown = ["```", "- [x] not a task", "```", "", "Inline `- [x] not a task` text", "", "- [x] real task"].join("\n");

    expect(uncheckAllTasks(markdown)).toBe(
      ["```", "- [x] not a task", "```", "", "Inline `- [x] not a task` text", "", "- [ ] real task"].join("\n"),
    );
  });
});

describe("removeCompletedTasks", () => {
  it("removes every completed task while preserving the remaining markdown", () => {
    const markdown = ["Intro", "- [x] first", "  continuation", "- [ ] second", "Outro"].join("\n");

    expect(removeCompletedTasks(markdown)).toBe(["Intro", "- [ ] second", "Outro"].join("\n"));
  });

  it("returns the original string when there are no completed tasks", () => {
    const markdown = ["Intro", "- [ ] first", "Outro"].join("\n");

    expect(removeCompletedTasks(markdown)).toBe(markdown);
  });

  it("ignores completed tasks inside fenced and inline code", () => {
    const markdown = ["```", "- [x] not a task", "```", "", "Inline `- [x] not a task` text", "", "- [x] real task"].join("\n");

    expect(removeCompletedTasks(markdown)).toBe(
      ["```", "- [x] not a task", "```", "", "Inline `- [x] not a task` text", "", ""].join("\n"),
    );
  });
});
