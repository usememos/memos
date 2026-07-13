import { Code, ConnectError } from "@connectrpc/connect";
import { describe, expect, it } from "vitest";
import { isInvalidUsernameError } from "@/lib/error";

describe("isInvalidUsernameError", () => {
  it("recognizes the username validation response", () => {
    const error = new ConnectError("invalid username: word.word", Code.InvalidArgument);

    expect(isInvalidUsernameError(error)).toBe(true);
  });

  it("does not hide unrelated invalid argument responses", () => {
    const error = new ConnectError("password must not be empty", Code.InvalidArgument);

    expect(isInvalidUsernameError(error)).toBe(false);
  });

  it("does not treat plain errors as server validation responses", () => {
    expect(isInvalidUsernameError(new Error("invalid username: word.word"))).toBe(false);
  });
});
