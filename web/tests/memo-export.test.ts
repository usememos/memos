import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exportMemos, stageMemoImport } from "@/lib/memo-export";

const { importRequest, download } = vi.hoisted(() => ({
  importRequest: vi.fn(),
  download: vi.fn(),
}));

vi.mock("@/connect", () => ({ userServiceClient: { importMemos: importRequest } }));
vi.mock("@/lib/browser", () => ({ downloadFileFromUrl: download }));

describe("memo export files", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("preflights the export route with HEAD and hands the download to the browser", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: { "Content-Disposition": "attachment; filename=memos-export-alice-20260920T083000Z.zip" },
      }),
    );

    await exportMemos("alice");

    expect(fetchSpy).toHaveBeenCalledWith("/file/users/alice/export", { method: "HEAD", credentials: "same-origin" });
    expect(download).toHaveBeenCalledWith("/file/users/alice/export", "memos-export-alice-20260920T083000Z.zip");
  });

  it("reports a refused preflight with its status instead of downloading", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 429 }));

    await expect(exportMemos("alice")).rejects.toMatchObject({ name: "MemoExportError", status: 429 });
    expect(download).not.toHaveBeenCalled();
  });

  it("escapes the username in the route", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));

    await exportMemos("a b");

    expect(download).toHaveBeenCalledWith("/file/users/a%20b/export", "memos-export-a b.zip");
  });

  it.each([
    ["golden.zip", "memos-export-alice.zip", "application/vnd.usememos.export+zip"],
    ["legacy.zip", "memos-archive-alice.zip", "application/vnd.usememos.archive+zip"],
    ["legacy.zip", "my-notes.zip", "application/zip"],
  ])("uploads %s as %s without filtering by the filename or MIME type", async (fixture, name, type) => {
    const bytes = readFileSync(resolve(import.meta.dirname, "../../core/memoexport/testdata/1.0", fixture));
    const file = new File([bytes], name, { type });
    const plan = { memoCount: 3 };
    importRequest.mockImplementation(async (request) => ({
      uploadId: "upload-id",
      maxChunkSize: 1024,
      committedSize: request.data ? request.writeOffset + BigInt(request.data.length) : 0n,
      result: request.finishWrite ? { case: "plan", value: plan } : { case: undefined },
    }));

    await expect(stageMemoImport("users/alice", file)).resolves.toEqual({ uploadId: "upload-id", size: bytes.length, plan });

    const chunks = importRequest.mock.calls.slice(1).map(([request]) => request.data);
    expect(Buffer.concat(chunks)).toEqual(bytes);
    expect(importRequest.mock.lastCall?.[0]).toMatchObject({ finishWrite: true, validateOnly: true });
  });
});
