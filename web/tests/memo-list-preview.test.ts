import { describe, expect, it } from "vitest";
import { getMemoListPreview } from "@/components/PagedMemoList/memoListPreview";

describe("getMemoListPreview", () => {
  it("uses the first text line as the title and the rest as the description", () => {
    expect(getMemoListPreview("Trip ideas\nLisbon in May\n\nPorto after")).toEqual({
      title: "Trip ideas",
      description: "Lisbon in May Porto after",
    });
  });

  it("strips block markers and inline markdown", () => {
    expect(getMemoListPreview("## **Weekly** review\n- [x] ship `split view`\n> see [the issue](https://example.com)")).toEqual({
      title: "Weekly review",
      description: "ship split view see the issue",
    });
  });

  it("skips code fences and rules and keeps hashtags", () => {
    expect(getMemoListPreview("```\nconst a = 1;\n```\n---\n#work #todo")).toEqual({
      title: "const a = 1;",
      description: "#work #todo",
    });
  });

  it("returns empty strings for blank content", () => {
    expect(getMemoListPreview("  \n\n")).toEqual({ title: "", description: "" });
  });
});
