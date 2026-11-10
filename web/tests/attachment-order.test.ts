import { create } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";
import type { LocalFile } from "@/components/MemoEditor/edit/types/attachment";
import {
  effectiveOrder,
  localFileOrderKey,
  moveGroup,
  orderAttachments,
  renameUploadedKeys,
  sortByOrder,
} from "@/components/MemoEditor/edit/utils/attachmentOrder";
import { previewOrder } from "@/components/MemoMetadata/Attachment/useDragReorder";
import { AttachmentSchema } from "@/types/proto/api/attachment_service_pb";

const attachment = (name: string) => create(AttachmentSchema, { name: `attachments/${name}`, filename: `${name}.png` });
const localFile = (previewUrl: string, replaces?: string): LocalFile => ({
  file: new File(["x"], `${previewUrl}.png`, { type: "image/png" }),
  previewUrl,
  replaces,
});

describe("attachment order", () => {
  it("keeps unlisted items in their natural place after the ordered ones", () => {
    expect(sortByOrder(["a", "b", "c", "d"], (key) => [key], ["c", "a"])).toEqual(["c", "a", "b", "d"]);
    expect(sortByOrder(["a", "b"], (key) => [key], [])).toEqual(["a", "b"]);
  });

  it("moves an item to its target's place, down after it and up before it", () => {
    expect(moveGroup([["a"], ["b"], ["c"]], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveGroup([["a"], ["b"], ["c"]], 2, 0)).toEqual(["c", "a", "b"]);
    // A Live Photo's two files move together.
    expect(moveGroup([["a"], ["still", "video"], ["c"]], 1, 0)).toEqual(["still", "video", "a", "c"]);
  });

  it("gives an edited drawing the key of the attachment it replaces", () => {
    expect(localFileOrderKey(localFile("blob:edit", "attachments/drawing"))).toBe("attachments/drawing");
    expect(localFileOrderKey(localFile("blob:new"))).toBe("blob:new");
  });

  it("falls back to saved attachments then new files before the first reorder", () => {
    expect(effectiveOrder([], [attachment("a")], [localFile("blob:n")])).toEqual(["attachments/a", "blob:n"]);
    expect(effectiveOrder(["blob:n"], [attachment("a")], [localFile("blob:n")])).toEqual(["blob:n"]);
  });

  it("saves new files where the draft placed them among the saved ones", () => {
    const saved = [attachment("a"), attachment("b")];
    const uploaded = attachment("new");
    const merged = [...saved, uploaded];
    const result = orderAttachments(merged, new Map([["blob:new", uploaded]]), ["attachments/a", "blob:new", "attachments/b"]);
    expect(result.map((item) => item.name)).toEqual(["attachments/a", "attachments/new", "attachments/b"]);
  });

  it("renames uploaded files' keys so a retry keeps their place", () => {
    expect(renameUploadedKeys(["attachments/a", "blob:new"], new Map([["blob:new", attachment("new")]]))).toEqual([
      "attachments/a",
      "attachments/new",
    ]);
  });

  it("shows the order a drag would drop into, and the committed order when idle", () => {
    expect(previewOrder(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(previewOrder(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(previewOrder(["a", "b", "c"], null, null)).toEqual(["a", "b", "c"]);
    expect(previewOrder(["a", "b", "c"], 1, 1)).toEqual(["a", "b", "c"]);
  });
});
