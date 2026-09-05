import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { describe, expect, it } from "vitest";
import { buildCalendarMonthModel } from "@/components/CalendarView/dayModel";
import { AttachmentSchema } from "@/types/proto/api/v1/attachment_service_pb";
import { type Memo, MemoSchema } from "@/types/proto/api/v1/memo_service_pb";

const memoAt = (date: Date, overrides: MessageInitShape<typeof MemoSchema> = {}): Memo =>
  create(MemoSchema, {
    name: `memos/${date.getTime()}`,
    createTime: timestampFromDate(date),
    updateTime: timestampFromDate(new Date(date.getTime() + 60_000)),
    content: "",
    ...overrides,
  });

const image = (name: string) => create(AttachmentSchema, { name: `attachments/${name}`, filename: `${name}.jpg`, type: "image/jpeg" });
const pdf = create(AttachmentSchema, { name: "attachments/doc", filename: "doc.pdf", type: "application/pdf" });

describe("calendar month model", () => {
  it("groups memos by local day and counts them", () => {
    const model = buildCalendarMonthModel(
      [memoAt(new Date(2026, 7, 2, 9)), memoAt(new Date(2026, 7, 2, 21)), memoAt(new Date(2026, 7, 3, 1))],
      "create_time",
    );
    expect(Object.keys(model).sort()).toEqual(["2026-08-02", "2026-08-03"]);
    expect(model["2026-08-02"].count).toBe(2);
    expect(model["2026-08-03"].count).toBe(1);
  });

  it("lists memos as rows in time order with a thumbnail when they carry an image", () => {
    const model = buildCalendarMonthModel(
      [
        memoAt(new Date(2026, 7, 2, 21), { snippet: "late", attachments: [image("late")] }),
        memoAt(new Date(2026, 7, 2, 9), { snippet: "early", attachments: [pdf] }),
      ],
      "create_time",
    );
    const entries = model["2026-08-02"].entries;
    expect(entries.map((entry) => entry.text)).toEqual(["early", "late"]);
    expect(entries[0].thumbnailUrl).toBeUndefined();
    expect(entries[1].thumbnailUrl).toContain("attachments/late/late.jpg");
    expect(entries[1].thumbnailUrl).toContain("thumbnail=true");
  });

  it("uses first non-empty lines, keeps image-only memos, and drops blank ones", () => {
    const model = buildCalendarMonthModel(
      [
        memoAt(new Date(2026, 7, 2, 8), { snippet: "  \nSecond line first\nmore" }),
        memoAt(new Date(2026, 7, 2, 9), { content: "Raw content only" }),
        memoAt(new Date(2026, 7, 2, 10), { content: "   " }),
        memoAt(new Date(2026, 7, 2, 11), { content: "", attachments: [image("photo")] }),
      ],
      "create_time",
    );
    expect(model["2026-08-02"].count).toBe(4);
    expect(model["2026-08-02"].entries.map((entry) => entry.text)).toEqual(["Second line first", "Raw content only", ""]);
    expect(model["2026-08-02"].entries[2].thumbnailUrl).toBeDefined();
  });

  it("caps entries while still counting every memo", () => {
    const memos = Array.from({ length: 10 }, (_, index) => memoAt(new Date(2026, 7, 2, index + 1), { snippet: `m${index}` }));
    const model = buildCalendarMonthModel(memos, "create_time");
    expect(model["2026-08-02"].count).toBe(10);
    expect(model["2026-08-02"].entries).toHaveLength(8);
  });

  it("buckets by update time when that is the basis", () => {
    const model = buildCalendarMonthModel([memoAt(new Date(2026, 7, 31, 23, 59, 30))], "update_time");
    expect(Object.keys(model)).toEqual(["2026-09-01"]);
  });

  it("counts redacted memos without giving them a row", () => {
    const model = buildCalendarMonthModel(
      [
        memoAt(new Date(2026, 7, 2, 9), { tags: ["private"], snippet: "secret", attachments: [image("secret")] }),
        memoAt(new Date(2026, 7, 2, 10), { snippet: "public" }),
      ],
      "create_time",
      { isRedacted: (memo) => memo.tags.includes("private") },
    );
    expect(model["2026-08-02"].count).toBe(2);
    expect(model["2026-08-02"].entries.map((entry) => entry.text)).toEqual(["public"]);
  });
});
