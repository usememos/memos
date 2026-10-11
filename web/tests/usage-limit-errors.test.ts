import { BinaryWriter } from "@bufbuild/protobuf/wire";
import { Code, ConnectError } from "@connectrpc/connect";
import { describe, expect, it } from "vitest";
import { errorService } from "@/components/MemoEditor/services/errorService";
import { ERROR_REASON_QUOTA_EXCEEDED, getErrorMessage, getRetryAfterSeconds } from "@/lib/error";

function quotaError(metadata: Record<string, string>): ConnectError {
  const writer = new BinaryWriter();
  writer.tag(1, 2).string(ERROR_REASON_QUOTA_EXCEEDED);
  writer.tag(2, 2).string("memos.api");
  for (const [key, value] of Object.entries(metadata)) {
    const entry = new BinaryWriter();
    entry.tag(1, 2).string(key);
    entry.tag(2, 2).string(value);
    writer.tag(3, 2).bytes(entry.finish());
  }
  const error = new ConnectError("quota exceeded", Code.ResourceExhausted);
  error.details.push({ type: "google.rpc.ErrorInfo", value: writer.finish() });
  return error;
}

describe("usage limit refusals", () => {
  it("names the memo limit", () => {
    const error = quotaError({ metric: "MEMOS", limit: "1000", usage: "1000", usage_limit: "usageLimits/default-memos" });
    expect(getErrorMessage(error)).toBe("You have reached your limit of 1000 memos. Delete memos to create new ones.");
  });

  it("names the storage limit and the current usage", () => {
    const error = quotaError({ metric: "STORAGE_BYTES", limit: String(1024 ** 3), usage: String(1000 * 1024 ** 2) });
    expect(getErrorMessage(error)).toBe("This upload would exceed your storage limit of 1.0 GB. You are using 1000.0 MB.");
  });

  it("names the per-file limit", () => {
    const error = quotaError({ metric: "UPLOAD_BYTES", limit: String(10 * 1024 ** 2), usage: String(20 * 1024 ** 2) });
    expect(getErrorMessage(error)).toBe("This file is larger than your limit of 10.0 MB per file.");
  });

  it("is not a rate limit, so it carries no wait", () => {
    const error = quotaError({ metric: "MEMOS", limit: "1", usage: "1" });
    expect(getRetryAfterSeconds(error)).toBeUndefined();
  });

  it("reaches the editor's own error messages", () => {
    const error = quotaError({ metric: "UPLOAD_BYTES", limit: String(1024 ** 2), usage: String(2 * 1024 ** 2) });
    expect(errorService.getErrorMessage(error)).toBe("This file is larger than your limit of 1.0 MB per file.");
  });
});
