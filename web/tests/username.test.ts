import { describe, expect, test } from "vitest";
import { isValidUsername, MAX_USERNAME_LENGTH } from "@/utils/username";

describe("isValidUsername", () => {
  test.each([
    ["alice", true],
    ["Alice-2", true],
    ["1alice", true],
    ["a--b", true],
    ["a---b", true],
    [`a${"b".repeat(MAX_USERNAME_LENGTH - 1)}`, true],
    ["", false],
    ["a".repeat(MAX_USERNAME_LENGTH + 1), false],
    ["123", true],
    ["123-456", true],
    ["00000000-0000-0000-0000-000000000000", true],
    ["-", false],
    ["---", false],
    ["-alice", false],
    ["alice-", false],
    ["alice_smith", false],
    ["alice@example.com", false],
    [" alice ", false],
    ["alice smith", false],
    ["álîçé", false],
    ["张三", false],
  ])("validates %j", (username, expected) => {
    expect(isValidUsername(username)).toBe(expected);
  });
});
