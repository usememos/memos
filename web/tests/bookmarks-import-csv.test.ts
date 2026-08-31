import { describe, expect, it } from "vitest";
import { parseCsv, parseRaindropCsv } from "@/components/BookmarksImport/csv";

describe("parseCsv", () => {
  it("parses plain rows", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("keeps commas inside quoted fields", () => {
    expect(parseCsv('1,"Emergency Rice, by Brickmason",url')).toEqual([["1", "Emergency Rice, by Brickmason", "url"]]);
  });

  it("keeps newlines inside quoted fields", () => {
    const csv = '1,"line one\nline two",url\n2,"after",url2';
    expect(parseCsv(csv)).toEqual([
      ["1", "line one\nline two", "url"],
      ["2", "after", "url2"],
    ]);
  });

  it("unescapes doubled quotes", () => {
    expect(parseCsv('"a ""quoted"" word",b')).toEqual([['a "quoted" word', "b"]]);
  });

  it("handles CRLF and trailing newline", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("parseRaindropCsv", () => {
  const header = "id,title,note,excerpt,url,folder,tags,created,cover,highlights,favorite";

  it("maps columns by header and filters non-http rows", () => {
    const rows = parseRaindropCsv(
      [
        header,
        '1,"Title, with comma","my note","",https://example.com/a,"Recursos de desarrollo","dev, ai",2026-08-29T10:22:48.966Z,,"a highlight",false',
        "2,Not a link,,,ftp://example.com/x,Unsorted,,,,,false",
        "3,,,,https://example.com/b,Unsorted,,,,,false",
      ].join("\n"),
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      title: "Title, with comma",
      note: "my note",
      url: "https://example.com/a",
      folder: "Recursos de desarrollo",
      tags: ["dev", "ai"],
      highlights: "a highlight",
    });
    expect(rows[1]).toMatchObject({ title: "", url: "https://example.com/b", tags: [] });
  });

  it("survives a real multiline-quoted folder value", () => {
    const csv = [
      header,
      '4,"Deep dive",,"excerpt",https://example.com/deep,"la presencia de una crisis existencial involucra una permuta parcial tanto en la identidad personal – i.e.,',
      ' crazy",dev,2026-08-01T00:00:00.000Z,,,false',
    ].join("\n");
    const rows = parseRaindropCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].folder).toContain("identidad personal");
    expect(rows[0].folder).toContain("crazy");
  });

  it("returns empty for header-only input", () => {
    expect(parseRaindropCsv(header)).toEqual([]);
    expect(parseRaindropCsv("")).toEqual([]);
  });
});
