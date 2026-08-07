import { describe, expect, it } from "vitest";
import { extractHeadings } from "@/utils/markdown-manipulation";

describe("extractHeadings", () => {
  it("uses rendered text for headings containing inline HTML", () => {
    const headings = extractHeadings(`# <ruby>連濁<rt>れんだく</rt></ruby>: "Why Hito-Bito isn't Hito-Hito"`);

    expect(headings).toEqual([
      {
        text: `連濁れんだく: "Why Hito-Bito isn't Hito-Hito"`,
        level: 1,
        slug: "why-hito-bito-isnt-hito-hito",
      },
    ]);
  });
});
