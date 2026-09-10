import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { describe, expect, it } from "vitest";
import { buildCalendarMonthModel } from "@/components/CalendarView/dayModel";
import { AttachmentSchema } from "@/types/proto/api/v1/attachment_service_pb";
import { type Memo, MemoSchema } from "@/types/proto/api/v1/memo_service_pb";

const memoAt = (hour: number, overrides: MessageInitShape<typeof MemoSchema> = {}): Memo =>
  create(MemoSchema, {
    name: `memos/${hour}`,
    createTime: timestampFromDate(new Date(2026, 7, 2, hour)),
    updateTime: timestampFromDate(new Date(2026, 7, 3, hour)),
    ...overrides,
  });
const image = (name: string) => create(AttachmentSchema, { name: `attachments/${name}`, filename: `${name}.jpg`, type: "image/jpeg" });
const pdf = create(AttachmentSchema, { name: "attachments/doc", filename: "doc.pdf", type: "application/pdf" });
const day = (memos: Memo[]) => buildCalendarMonthModel(memos, "create_time")["2026-08-02"];

describe("calendar day snapshots", () => {
  it("groups by local day and keeps every memo in chronological order", () => {
    const memos = Array.from({ length: 24 }, (_, i) => memoAt(i, { content: `memo ${i}` })).reverse();
    const summary = day(memos);
    expect(summary.memos).toHaveLength(24);
    expect(summary.memos[0].name).toBe("memos/0");
    expect(summary.excerpt?.text).toBe("memo 0");
  });

  it("uses memo identity to choose the same sample when timestamps tie", () => {
    const a = memoAt(9, { name: "memos/a", content: "first" });
    const b = memoAt(9, { name: "memos/b", content: "second" });
    expect(day([b, a]).excerpt).toEqual(day([a, b]).excerpt);
    expect(day([b, a]).excerpt?.text).toBe("first");
  });

  it("uses full Markdown content instead of a truncated snippet, without markup or image captions", () => {
    const summary = day([
      memoAt(9, {
        content: "# Morning\n\nA **quiet** walk with [a friend](https://example.com).\n\n![caption](/photo.jpg)",
        snippet: "Morning…",
      }),
    ]);
    expect(summary.excerpt?.text).toBe("Morning\nA quiet walk with a friend.");
    expect(summary.excerpt?.isCode).toBe(false);
  });

  it("preserves readable code and checklist text without fences or active checkboxes", () => {
    expect(day([memoAt(9, { content: "```js\nconst x = 1;\nconsole.log(x);\n```" })]).excerpt).toMatchObject({
      text: "const x = 1;\nconsole.log(x);",
      isCode: true,
    });
    expect(day([memoAt(9, { content: "- [x] Ship release\n- [ ] Write notes" })]).excerpt?.text).toBe("Ship release\nWrite notes");
  });

  it("skips empty and image-only memos when choosing text and keeps photos from distinct memos", () => {
    const summary = day([
      memoAt(8),
      memoAt(9, { attachments: [image("a"), image("b")] }),
      memoAt(10, { content: "The day's writing", attachments: [image("c")] }),
      memoAt(11, { attachments: [image("d")] }),
    ]);
    expect(summary.excerpt?.text).toBe("The day's writing");
    expect(summary.images.map((entry) => entry.memoName)).toEqual(["memos/9", "memos/10"]);
    expect(summary.images[0].thumbnailUrl).toContain("attachments/a/a.jpg?thumbnail=true");
    expect(summary.memos).toHaveLength(4);
  });

  it("does not duplicate an inline attachment or a repeated image", () => {
    const photo = image("a");
    expect(
      day([
        memoAt(9, { content: "![photo](/file/attachments/a/a.jpg)", attachments: [photo] }),
        memoAt(10, { attachments: [photo] }),
        memoAt(11, { attachments: [image("b")] }),
      ]).images,
    ).toHaveLength(2);
  });

  it("prefers Markdown images over attachment order and supports local SVG references", () => {
    const svg = create(AttachmentSchema, { name: "attachments/bird", filename: "bird.svg", type: "image/svg+xml" });
    const result = day([memoAt(9, { content: "![bird](/file/attachments/bird)", attachments: [image("a"), svg] })]);
    expect(result.images[0].thumbnailUrl).toContain("attachments/bird/bird.svg?thumbnail=true");
    expect(result.images).toHaveLength(1);
  });

  it("extracts external and reference-style images in content order", () => {
    const result = day([
      memoAt(9, {
        content:
          "![first][PHOTO]\n\n![second](https://example.com/second.jpg)\n\n[photo]: https://example.com/first.jpg\n[photo]: https://example.com/ignored.jpg",
        attachments: [image("a")],
      }),
      memoAt(10, { content: "![next](https://example.com/next.jpg)" }),
    ]);
    expect(result.images.map((entry) => entry.thumbnailUrl)).toEqual(["https://example.com/first.jpg", "https://example.com/next.jpg"]);
  });

  it("deduplicates content and attachment images before filling the next day slot", () => {
    const photo = image("a");
    const result = day([
      memoAt(9, { content: "![a](/file/attachments/a)", attachments: [photo] }),
      memoAt(10, { content: "![a](/file/attachments/a/a.jpg)\n\n![b](https://example.com/b.jpg)", attachments: [photo] }),
    ]);
    expect(result.images).toHaveLength(2);
    expect(result.images[1].thumbnailUrl).toBe("https://example.com/b.jpg");
  });

  it("deduplicates equivalent external URLs", () => {
    const result = day([
      memoAt(9, { content: "![a](https://EXAMPLE.com/a.jpg)" }),
      memoAt(10, { content: "![a](https://example.com/a.jpg)\n\n![b](https://example.com/b.jpg)" }),
    ]);
    expect(result.images.map((entry) => entry.thumbnailUrl)).toEqual(["https://EXAMPLE.com/a.jpg", "https://example.com/b.jpg"]);
  });

  it("ignores code examples, raw HTML, unresolved references, and disallowed image URLs", () => {
    const result = day([
      memoAt(9, {
        content: [
          "`![code](https://example.com/code.jpg)`",
          "```md\n![fenced](https://example.com/fenced.jpg)\n```",
          '<img src="https://example.com/html.jpg">',
          "![missing][undefined]",
          "![data](data:image/png;base64,AAAA)",
          "![insecure](http://example.com/insecure.jpg)",
          "![script](javascript:alert)",
          "![managed](/file/attachments/missing)",
          "![valid](https://example.com/valid.jpg)",
        ].join("\n\n"),
      }),
    ]);
    expect(result.images.map((entry) => entry.thumbnailUrl)).toEqual(["https://example.com/valid.jpg"]);
  });

  it("does not turn an image-only memo's alt text into an excerpt", () => {
    const result = day([memoAt(9, { content: "![caption](https://example.com/a.jpg)", snippet: "caption" })]);
    expect(result.excerpt).toBeUndefined();
    expect(result.images).toHaveLength(1);
  });

  it("uses a filename only when the day has no readable text", () => {
    expect(day([memoAt(9, { attachments: [pdf] })]).excerpt?.text).toBe("doc.pdf");
    expect(day([memoAt(9, { attachments: [pdf] }), memoAt(10, { content: "Notes" })]).excerpt?.text).toBe("Notes");
  });

  it("counts hidden memos without exposing text, filenames, or photos", () => {
    const summary = buildCalendarMonthModel(
      [
        memoAt(9, { tags: ["private"], content: "secret ![private](https://example.com/secret.jpg)", attachments: [pdf, image("secret")] }),
        memoAt(10, { content: "visible" }),
      ],
      "create_time",
      { isRedacted: (memo) => memo.tags.includes("private") },
    )["2026-08-02"];
    expect(summary.memos).toHaveLength(2);
    expect(summary.excerpt?.text).toBe("visible");
    expect(summary.images).toEqual([]);
  });

  it("uses update time when selected and ignores undated memos", () => {
    expect(Object.keys(buildCalendarMonthModel([memoAt(9), create(MemoSchema)], "update_time"))).toEqual(["2026-08-03"]);
  });
});
