import { describe, expect, test } from "vitest";
import { parsePollDefinition } from "@/components/MemoContent/poll/types";

describe("parsePollDefinition", () => {
  test("parses a canonical YAML poll block", () => {
    const content = [
      "id: 4339e913-84b2-4136-84d6-af9e5fada086",
      "question: What day",
      "type: single",
      "options:",
      "  - Monday",
      "  - Friday",
    ].join("\n");

    expect(parsePollDefinition(content)).toEqual({
      id: "4339e913-84b2-4136-84d6-af9e5fada086",
      question: "What day",
      type: "single",
      options: ["Monday", "Friday"],
    });
  });

  test("defaults to single-choice when type is absent", () => {
    const content = ["id: 11111111-1111-1111-1111-111111111111", "question: Q", "options:", "  - A", "  - B"].join("\n");

    expect(parsePollDefinition(content)?.type).toBe("single");
  });

  test("parses multiple-choice", () => {
    const content = ["id: 22222222-2222-2222-2222-222222222222", "question: Q", "type: multiple", "options:", "  - A", "  - B"].join("\n");

    expect(parsePollDefinition(content)?.type).toBe("multiple");
  });

  test("rejects malformed YAML", () => {
    const content = ["id: 33333333-3333-3333-3333-333333333333", "question: [unterminated", "options:", "  - A", "  - B"].join("\n");

    expect(parsePollDefinition(content)).toBeNull();
  });

  test("rejects an invalid poll id", () => {
    expect(parsePollDefinition("id: not-a-uuid\nquestion: Q\noptions:\n  - A\n  - B")).toBeNull();
  });

  test("rejects fewer than two options", () => {
    const content = ["id: 44444444-4444-4444-4444-444444444444", "question: Q", "options:", "  - OnlyOne"].join("\n");

    expect(parsePollDefinition(content)).toBeNull();
  });

  test("rejects a bare non-object YAML scalar", () => {
    expect(parsePollDefinition("just some text, not a mapping")).toBeNull();
  });

  test("also accepts flow-style YAML", () => {
    const content = '{"id": "55555555-5555-5555-5555-555555555555", "question": "Q", "options": ["A", "B"]}';

    expect(parsePollDefinition(content)).toEqual({
      id: "55555555-5555-5555-5555-555555555555",
      question: "Q",
      type: "single",
      options: ["A", "B"],
    });
  });
});
