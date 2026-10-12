import { describe, expect, it } from "vitest";
import { getMemoSuggestions } from "@/lib/memo-suggestions";
import { extractTagConditions } from "@/lib/tag-suggestions";

describe("tag suggestion extraction", () => {
  it.each([
    ['"work" in tags', ["work"]],
    ["'work/project' in tags", ["work/project"]],
    ['tag in ["work", "release",]', ["work", "release"]],
    ['("work" in tags && "release" in tags) || "personal" in tags', ["work", "release", "personal"]],
    ['has_task_list && "work" in tags && content.contains("release")', ["work"]],
    ['"work" in tags // ignore this: && !("work" in tags)', ["work"]],
    ['"\\u5de5\\u4f5c" in tags', ["工作"]],
    ["'it\\'s' in tags", ["it's"]],
    ['!("archived" in tags)', []],
    ['!("archived" in tags || "private" in tags)', []],
    ['!("archived" in tags && !("work" in tags))', ["work"]],
    ['content.contains("work")', []],
    ["content.contains('\"work\" in tags')", []],
    ['tags.exists(t, t.startsWith("work/"))', []],
    ['("work" in tags) == false', []],
    ['true ? "work" in tags : "personal" in tags', []],
    ['"work" in tags &&', []],
    ['"work" in tags && visibility ==', []],
    ['("work" in tags', []],
    ['"work" in tags || content.contains("x"', []],
    ['"work" in tags && x[)', []],
    ['"work" in tags && @', []],
    ['tag in ["work", variable]', []],
    ["tag in []", []],
  ])("extracts explicit tags conservatively: %s", (source, expected) => {
    expect(extractTagConditions(source).candidates).toEqual(expected);
  });

  it("combines unconditional exclusions without treating an OR branch as a global exclusion", () => {
    expect([...extractTagConditions('!("work" in tags) && !("personal" in tags)').excluded]).toEqual(["work", "personal"]);
    expect([...extractTagConditions('!("work" in tags) || "personal" in tags').excluded]).toEqual([]);
    expect([...extractTagConditions('!("work" in tags) || (!("work" in tags) && has_task_list)').excluded]).toEqual(["work"]);
    expect([...extractTagConditions('!(tag in ["work", "personal"])').excluded]).toEqual(["work", "personal"]);
    expect([...extractTagConditions('!("work" in tags && "personal" in tags)').excluded]).toEqual([]);
  });
});

describe("memo suggestions", () => {
  it("ranks selection before search before View, deduplicates, and leaves the visible limit to the editor", () => {
    const suggestions = getMemoSuggestions(
      [
        { factor: "celSearch", value: 'tag in ["search", "selected"]' },
        { factor: "tagSearch", value: "selected" },
        { factor: "tagSearch", value: "second" },
      ],
      'tag in ["view", "search", "selected"]',
    );
    expect(suggestions.map(({ id, source }) => [id, source])).toEqual([
      ["tag:selected", "selection"],
      ["tag:second", "selection"],
      ["tag:search", "search"],
      ["tag:view", "view"],
    ]);
    expect(suggestions[0]).toMatchObject({ kind: "tag", tag: "selected" });
  });

  it("applies exclusions across sources and ignores plain-text searches", () => {
    expect(
      getMemoSuggestions(
        [
          { factor: "tagSearch", value: "archived" },
          { factor: "celSearch", value: '!("work" in tags)' },
          { factor: "contentSearch", value: "#personal" },
        ],
        '!("archived" in tags) && tag in ["work", "release"]',
      ).map((suggestion) => suggestion.id),
    ).toEqual(["tag:release"]);
  });

  it("does not exclude a selected tag merely because one alternative negates it", () => {
    expect(
      getMemoSuggestions([{ factor: "tagSearch", value: "work" }], '!("work" in tags) || "personal" in tags').map(
        (suggestion) => suggestion.id,
      ),
    ).toEqual(["tag:work", "tag:personal"]);
  });

  it("validates complete tag identities and preserves case, Unicode, punctuation, and paths", () => {
    const tags = ["work/project", "工作", "🎉", "C++", "R&D", "Work", "work", "", "two words", "#work", "work/", "x\ny", "wo\u200brk"];
    expect(getMemoSuggestions(tags.map((value) => ({ factor: "tagSearch", value }))).map((suggestion) => suggestion.id)).toEqual(
      tags.slice(0, 7).map((tag) => `tag:${tag}`),
    );
  });
});

describe("checklist suggestions", () => {
  it.each([
    ["has_task_list", true],
    ["has_incomplete_tasks", true],
    ["has_task_list == true", true],
    ["has_task_list != false", true],
    ["!(has_task_list == false)", true],
    ["has_task_list || content.contains('todo')", true],
    ["!has_task_list", false],
    ["has_task_list == false", false],
    ["has_task_list && !has_incomplete_tasks", false],
    ["has_task_list && !has_task_list", false],
    ["content.contains('has_task_list')", false],
    ["has_task_list &&", false],
  ])("reads task conditions: %s", (value, expected) => {
    expect(getMemoSuggestions([{ factor: "celSearch", value }]).some((item) => item.kind === "checklist")).toBe(expected);
  });

  it("ranks and deduplicates across kinds and applies exclusions across contexts", () => {
    expect(
      getMemoSuggestions(
        [
          { factor: "property.hasTaskList", value: "true" },
          { factor: "celSearch", value: 'has_task_list && "work" in tags' },
        ],
        'has_task_list && "view" in tags',
      ).map(({ id, source }) => [id, source]),
    ).toEqual([
      ["checklist", "selection"],
      ["tag:work", "search"],
      ["tag:view", "view"],
    ]);
    expect(getMemoSuggestions([{ factor: "property.hasTaskList", value: "true" }], "!has_task_list")).toEqual([]);
  });
});

describe("visibility suggestions", () => {
  it.each([
    ['visibility == "PRIVATE"', "PRIVATE"],
    ['"PUBLIC" == visibility', "PUBLIC"],
    ['visibility == "PROTECTED"', "PROTECTED"],
    ['visibility in ["SPACE",]', "SPACE"],
    ['!(visibility != "PRIVATE")', "PRIVATE"],
    ['visibility == "PRIVATE" || (visibility == "PRIVATE" && has_task_list)', "PRIVATE"],
    ['visibility in ["PRIVATE", "PUBLIC"] && visibility != "PUBLIC"', "PRIVATE"],
    ['visibility == "PRIVATE" || visibility == "PUBLIC"', undefined],
    ['visibility == "PUBLIC" || content.contains("x")', undefined],
    ['visibility != "PRIVATE"', undefined],
    ['visibility == "private"', undefined],
    ['visibility == "UNKNOWN"', undefined],
    ['visibility == "PRIVATE" && visibility == "PUBLIC"', undefined],
    ["content.contains('visibility == \"PUBLIC\"')", undefined],
    ['visibility == "PUBLIC" &&', undefined],
    ['visibility != "PRIVATE" && visibility != "SPACE" && visibility != "PROTECTED"', undefined],
  ])("requires a single explicit audience: %s", (value, expected) => {
    expect(
      getMemoSuggestions([{ factor: "celSearch", value }])
        .filter((item) => item.kind === "visibility")
        .map((item) => item.id),
    ).toEqual(expected ? [`visibility:${expected}`] : []);
  });

  it("respects conflicts and chooses the strongest agreeing source", () => {
    expect(getMemoSuggestions([{ factor: "visibility", value: "PRIVATE" }], 'visibility == "PUBLIC"')).toEqual([]);
    expect(
      getMemoSuggestions(
        [
          { factor: "visibility", value: "PRIVATE" },
          { factor: "celSearch", value: 'visibility == "PRIVATE"' },
        ],
        'visibility == "PRIVATE"',
      ),
    ).toMatchObject([{ id: "visibility:PRIVATE", source: "selection" }]);
  });
});
