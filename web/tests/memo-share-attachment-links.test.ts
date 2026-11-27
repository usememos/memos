import { describe, expect, it, vi } from "vitest";
import { withShareAttachmentLinks } from "@/hooks/useMemoShareQueries";
import type { Attachment } from "@/types/proto/api/attachment_service_pb";

vi.mock("@/connect", () => ({ memoServiceClient: {} }));

describe("shared attachment filename URLs", () => {
  it.each(["100% complete.txt", "ảnh#1?.png", "literal%20name.txt"])("keeps the filename and share token for %s", (filename) => {
    const attachment = { name: "attachments/test-uid", filename } as Attachment;
    const [shared] = withShareAttachmentLinks([attachment], "test-token");
    const url = new URL(shared.externalLink);

    expect(decodeURIComponent(url.pathname.split("/").at(-1)!)).toBe(filename);
    expect(url.hash).toBe("");
    expect([...url.searchParams.entries()]).toEqual([["share_token", "test-token"]]);
  });

  it("preserves an existing external URL", () => {
    const attachment = { externalLink: "https://cdn.example.com/photo.png?version=123" } as Attachment;

    expect(withShareAttachmentLinks([attachment], "test-token")[0]).toBe(attachment);
  });
});
