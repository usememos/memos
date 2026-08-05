import { describe, expect, it } from "vitest";
import { buildTagTree } from "@/components/TagTree";

describe("tag tree", () => {
  it("preserves exact counts, including one", () => {
    const tree = buildTagTree([
      ["a", 2],
      ["a/b", 1],
    ]);

    expect(tree).toMatchObject([
      {
        key: "a",
        text: "a",
        amount: 2,
        subTags: [{ key: "b", text: "a/b", amount: 1, subTags: [] }],
      },
    ]);
  });

  it("keeps generated parent paths structural", () => {
    const tree = buildTagTree([["personal/travel/singapore", 2]]);

    expect(tree[0].amount).toBeUndefined();
    expect(tree[0].subTags[0].amount).toBeUndefined();
    expect(tree[0].subTags[0].subTags[0]).toMatchObject({
      key: "singapore",
      text: "personal/travel/singapore",
      amount: 2,
    });
  });
});
