import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.doUnmock("@pierre/highlights");
});

afterEach(() => vi.unstubAllGlobals());

describe("code highlighting", () => {
  it("leaves plain text undecorated and loads normalized language aliases on demand", async () => {
    const { highlightLoadedCode, loadHighlighter } = await import("@/lib/code-highlight");
    expect(highlightLoadedCode("const value = 1;", "js")).toBeUndefined();
    for (const language of ["", "plain", "plaintext", "text", "txt"]) {
      expect(highlightLoadedCode("<script>&</script>", language)).toEqual([]);
    }
    await loadHighlighter(" JS ");
    const ranges = highlightLoadedCode("const value = 1;", "js");
    expect(ranges?.[0]).toMatchObject({ from: 0, class: "memos-code-token" });
    expect(ranges?.[0].attributes?.style).toContain("light-dark(");
  });

  it("uses source UTF-16 offsets across Unicode, CRLF and multiline tokens", async () => {
    const { highlightLoadedCode, loadHighlighter } = await import("@/lib/code-highlight");
    await loadHighlighter("typescript");
    const code = 'const emoji = "😀中文";\r\n/* first\nsecond */\nconst tail = 2;';
    const ranges = highlightLoadedCode(code, "typescript") ?? [];
    const slices = ranges.map(({ from, to }) => code.slice(from, to));
    expect(slices).toContain('"😀中文"');
    expect(slices).toContain("/* first");
    expect(slices).toContain("second */");
    expect(ranges.find(({ from }) => from === code.lastIndexOf("const"))?.class).toBe("memos-code-token");
    expect(ranges.every(({ from, to }) => from >= 0 && to > from && to <= code.length)).toBe(true);
  });

  it("leaves ordinary text and structural punctuation to the editor's foreground", async () => {
    const { highlightLoadedCode, loadHighlighter } = await import("@/lib/code-highlight");
    await loadHighlighter("js");
    const code = 'const message = "hello";';
    const ranges = highlightLoadedCode(code, "js") ?? [];
    expect(ranges.map(({ from, to }) => code.slice(from, to))).toEqual(["const ", '"hello"']);
  });

  it("leaves unsupported languages plain", async () => {
    const { highlightLoadedCode, loadHighlighter } = await import("@/lib/code-highlight");
    await loadHighlighter("brainfuck");
    expect(highlightLoadedCode("++[>++<-]", "brainfuck")).toEqual([]);
    await loadHighlighter("not-a-language");
    expect(highlightLoadedCode("<script>&</script>", "not-a-language")).toEqual([]);
  });

  it("keeps plain code when the Wasm module cannot initialize", async () => {
    vi.doMock("@pierre/highlights", () => {
      throw new Error("WebAssembly unavailable");
    });
    const { highlightLoadedCode, loadHighlighter } = await import("@/lib/code-highlight");
    await loadHighlighter("js");
    expect(highlightLoadedCode("const value = 1;", "js")).toEqual([]);
  });

  it("keeps plain code when light-dark colors are unavailable", async () => {
    vi.stubGlobal("CSS", { supports: () => false });
    const { highlightLoadedCode, loadHighlighter } = await import("@/lib/code-highlight");
    await loadHighlighter("js");
    expect(highlightLoadedCode("const value = 1;", "js")).toEqual([]);
  });
});
