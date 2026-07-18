import { Code, ConnectError } from "@connectrpc/connect";
import { describe, expect, it } from "vitest";
import { getErrorMessage } from "@/lib/error";

describe("getErrorMessage", () => {
  it("returns a Connect error message without its status code", () => {
    const error = new ConnectError("invalid username", Code.InvalidArgument);

    expect(getErrorMessage(error)).toBe("invalid username");
  });

  it("uses the fallback for an empty Connect error message", () => {
    const error = new ConnectError("", Code.InvalidArgument);

    expect(getErrorMessage(error, "Request failed")).toBe("Request failed");
  });
});
