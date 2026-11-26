import { BinaryWriter } from "@bufbuild/protobuf/wire";
import { Code, ConnectError } from "@connectrpc/connect";
import { beforeAll, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { ERROR_REASON_RATE_LIMITED, getErrorInfo, getErrorMessage, getRetryAfterSeconds, hasErrorReason } from "@/lib/error";

function encodeErrorInfo(reason: string, domain: string, metadata: Record<string, string>): Uint8Array {
  const writer = new BinaryWriter();
  writer.tag(1, 2).string(reason);
  writer.tag(2, 2).string(domain);
  for (const [key, value] of Object.entries(metadata)) {
    const entry = new BinaryWriter();
    entry.tag(1, 2).string(key);
    entry.tag(2, 2).string(value);
    writer.tag(3, 2).bytes(entry.finish());
  }
  return writer.finish();
}

function rateLimitError(retryAfterSeconds: string): ConnectError {
  // Incoming details arrive as raw type-url and bytes pairs; mirror that shape.
  const error = new ConnectError("too many requests, try again later", Code.ResourceExhausted);
  error.details.push(
    {
      type: "google.rpc.ErrorInfo",
      value: encodeErrorInfo(ERROR_REASON_RATE_LIMITED, "memos.api", {
        scope: "signin_ip",
        retry_after_seconds: retryAfterSeconds,
      }),
    },
    { type: "google.rpc.RetryInfo", value: new Uint8Array([10, 2, 8, 42]) },
  );
  return error;
}

// The messages come from the English catalog, which loads on demand.
beforeAll(() => i18n.changeLanguage("en"));

describe("ErrorInfo decoding", () => {
  it("reads reason, domain and metadata from the detail", () => {
    const info = getErrorInfo(rateLimitError("42"));
    expect(info).toEqual({
      reason: ERROR_REASON_RATE_LIMITED,
      domain: "memos.api",
      metadata: { scope: "signin_ip", retry_after_seconds: "42" },
    });
    expect(hasErrorReason(rateLimitError("42"), ERROR_REASON_RATE_LIMITED)).toBe(true);
  });

  it("turns a rate-limit refusal into a wait message", () => {
    expect(getRetryAfterSeconds(rateLimitError("42"))).toBe(42);
    expect(getErrorMessage(rateLimitError("42"))).toBe("Too many requests. Try again in 42s.");
    expect(getErrorMessage(rateLimitError("300"))).toBe("Too many requests. Try again in 5 min.");
  });

  it("words a failed AI provider call from its reason, not the server's English message", () => {
    const failure = (reason: string) => {
      const error = new ConnectError("the provider rejected the API key or denied access", Code.FailedPrecondition);
      error.details.push({ type: "google.rpc.ErrorInfo", value: encodeErrorInfo(reason, "memos.api", { upstream_status: "401" }) });
      return error;
    };
    expect(getErrorMessage(failure("AI_PROVIDER_AUTH_FAILED"))).toBe("The provider rejected the API key or denied access.");
    expect(getErrorMessage(failure("AI_PROVIDER_QUOTA_EXHAUSTED"))).toBe(
      "The provider account is out of credit or over its spending limit.",
    );
    expect(getErrorMessage(failure("AI_PROVIDER_ERROR"))).toBe(getErrorMessage(failure("AI_INVALID_RESPONSE")));
    // A reason this client does not know keeps the server's message.
    expect(getErrorMessage(failure("AI_SOMETHING_NEW"))).toBe("the provider rejected the API key or denied access");
  });

  it("leaves other errors alone", () => {
    const plain = new ConnectError("nope", Code.InvalidArgument);
    expect(getErrorInfo(plain)).toBeUndefined();
    expect(getRetryAfterSeconds(plain)).toBeUndefined();
    expect(getErrorMessage(plain)).toBe("nope");
    expect(getErrorInfo(new Error("x"))).toBeUndefined();
  });
});
