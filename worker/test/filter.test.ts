import { describe, expect, it } from "vitest";
import { MEMO_FILTER_SCHEMA, renderFilter } from "../src/filter/render";
import { extractAll, generateSnippet } from "../src/markdown/extract";

const render = (filter: string) => renderFilter(filter, MEMO_FILTER_SCHEMA);

describe("CEL filter → SQL", () => {
  it("renders frontend-shaped filters", () => {
    const cases: [string, string][] = [
      ["pinned", "memo.pinned = 1"],
      ["has_link", "COALESCE(json_extract(memo.payload, '$.property.hasLink'), 0) = 1"],
      ['visibility in ["PUBLIC", "PROTECTED"]', "memo.visibility IN (?, ?)"],
      ['creator == "users/admin"', "('users/' || memo_creator.username) = ?"],
    ];
    for (const [filter, expected] of cases) {
      expect(render(filter).sql).toBe(expected);
    }
  });

  it("renders content.contains with escaped LIKE", () => {
    const { sql, args } = render('content.contains("50%_done")');
    expect(sql).toBe("LOWER(memo.content) LIKE LOWER(?) ESCAPE '\\'");
    expect(args).toEqual(["%50\\%\\_done%"]);
  });

  it("renders tag in [...] with hierarchical matching", () => {
    const { sql, args } = render('tag in ["work"]');
    expect(sql).toContain("json_each(COALESCE(json_extract(memo.payload, '$.tags'), '[]'))");
    expect(args).toEqual(["work", "work/%"]);
  });

  it("renders timestamp range from the calendar filter", () => {
    const { sql, args } = render("created_ts >= timestamp(1700000000) && created_ts < timestamp(1700086400)");
    expect(sql).toBe("(memo.created_ts >= ? AND memo.created_ts < ?)");
    expect(args).toEqual([1700000000, 1700086400]);
  });

  it("renders now() - duration arithmetic", () => {
    const { sql, args } = render('created_ts >= now() - duration("24h")');
    expect(sql).toBe("memo.created_ts >= (? - ?)");
    expect(args[1]).toBe(86400);
  });

  it("renders exists macro over tags", () => {
    const { sql, args } = render('tags.exists(t, t.startsWith("archive"))');
    expect(sql).toBe(
      "EXISTS (SELECT 1 FROM json_each(COALESCE(json_extract(memo.payload, '$.tags'), '[]')) WHERE json_each.value LIKE ? ESCAPE '\\')",
    );
    expect(args).toEqual(["archive%"]);
  });

  it("renders element-in and logical composition", () => {
    const { sql } = render('"work" in tags || (pinned && has_code)');
    expect(sql).toContain(" OR ");
    expect(sql).toContain("memo.pinned = 1");
  });

  it("renders size() and negation", () => {
    const { sql } = render("!(size(tags) == 0)");
    expect(sql).toBe("NOT (json_array_length(COALESCE(json_extract(memo.payload, '$.tags'), '[]')) = ?)");
  });

  it("rejects unknown fields and matches()", () => {
    expect(() => render('secret == "x"')).toThrow(/unknown filter field/);
    expect(() => render('content.matches(".*")')).toThrow(/not supported/);
  });
});

describe("markdown extraction", () => {
  it("extracts tags, mentions and properties", () => {
    const data = extractAll(
      "# Заголовок\n\nHello #work/project and #дом! Ping @alice, not an email a@b.com.\n\n- [ ] todo\n- [x] done\n\n`код` [link](https://x.dev) #another",
    );
    expect(data.tags).toEqual(["work/project", "дом", "another"]);
    expect(data.mentions).toEqual(["alice"]);
    expect(data.property).toMatchObject({
      hasLink: true,
      hasCode: true,
      hasTaskList: true,
      hasIncompleteTasks: true,
      title: "Заголовок",
    });
  });

  it("does not extract tags from headings or code", () => {
    const data = extractAll("## not-a-tag\n\n```\n#code-tag\n```\n");
    expect(data.tags).toEqual([]);
    expect(data.property.hasCode).toBe(true);
  });

  it("generates a plain-text snippet", () => {
    const snippet = generateSnippet("# Title\n\nSome **bold** text with #tag\n\n```js\nignored()\n```", 64);
    expect(snippet).toContain("Title");
    expect(snippet).toContain("Some bold text");
    expect(snippet).not.toContain("ignored");
  });
});
