import { describe, expect, it } from "vitest";
import { findTagMatches } from "@/utils/tag-grammar";

const values = (source: string) => findTagMatches(source).map((match) => match.value);

describe("tag scanner", () => {
  it.each([
    ["#tag", ["tag"]],
    ["hello#tag", ["tag"]],
    ["#标签", ["标签"]],
    ["#2026", ["2026"]],
    ["#C++", ["C++"]],
    ["#R&D", ["R&D"]],
    ["#-foo #foo- #--- #&&", ["-foo", "foo-", "---", "&&"]],
    ["#work/notes", ["work/notes"]],
    ["#book/", ["book"]],
    ["#/book", []],
    ["#book//fiction", ["book"]],
    ["#book/fiction/", ["book/fiction"]],
    ["#l·l #foo‿bar", ["l·l", "foo‿bar"]],
    ["#tag's #сім'я #O'Brien #O’Brien #OʼBrien", ["tag's", "сім'я", "O'Brien", "O’Brien", "OʼBrien"]],
    ["#café's", ["café's"]],
    ["'#tag' #users' #'missing #rock''roll", ["tag", "users", "rock"]],
    ["#O‘Brien #foo-'bar #foo'1️⃣ #A‍'B", ["O", "foo-", "foo", "A"]],
    ["#foo,bar #price€ #€budget #v²", ["foo", "price", "v"]],
    ["#first#second", ["first", "second"]],
    ["##tag", ["tag"]],
    ["＃tag ﹟tag", []],
  ])("scans %s", (source, expected) => {
    expect(values(source)).toEqual(expected);
  });

  it("emits ignored source code points only in the source span", () => {
    const source = "#A‍B #‍foo #A‌B #‌foo #A️B #́foo #café #foo/́bar";
    expect(values(source)).toEqual(["AB", "foo", "AB", "foo", "AB", "foo", "café", "foo/bar"]);
    expect(findTagMatches("#A‍B")[0]).toMatchObject({ from: 0, to: 4, source: "A‍B", value: "AB" });
    expect(values("#‍‌ #́")).toEqual([]);
  });

  it("matches fully-qualified emoji atomically and excludes components", () => {
    expect(values("#*️⃣ #‼️ #♥ #♥️ #🏻")).toEqual(["*️⃣", "‼️", "♥️"]);
    expect(values("#️⃣ ##️⃣ #first#️⃣")).toEqual(["#️⃣", "first#️⃣"]);
  });

  it("uses the checked-in Unicode 17 and Emoji 17 repertoire", () => {
    expect(values("#꟎ #🫯")).toEqual(["꟎", "🫯"]);
  });

  it("has no tag-specific length limit", () => {
    const tag = "a".repeat(101);
    expect(values(`#${tag}`)).toEqual([tag]);
  });

  it("does not match an emoji across the requested source limit", () => {
    expect(findTagMatches("#😀", 0, 2)).toEqual([]);
  });

  it("does not join an apostrophe across the requested source limit", () => {
    expect(findTagMatches("#O'B", 0, 3).map((match) => match.value)).toEqual(["O"]);
  });
});
