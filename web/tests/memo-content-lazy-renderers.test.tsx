import { render, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { highlightCode } from "@/components/MemoContent/highlight";
import { MemoMarkdownRenderer } from "@/components/MemoContent/MemoMarkdownRenderer";
import { hasMathSyntax } from "@/components/MemoContent/math";

describe("memo content lazy renderers", () => {
  it("detects math in prose but ignores escaped dollars and code", () => {
    expect(hasMathSyntax("Inline $L$ formula")).toBe(true);
    expect(hasMathSyntax("Display $$x$$ formula")).toBe(true);
    expect(hasMathSyntax("Display\n$$\nx + y\n$$")).toBe(true);

    expect(hasMathSyntax(String.raw`Price is \$5`)).toBe(false);
    expect(hasMathSyntax("Inline code: `$L$`")).toBe(false);
    expect(hasMathSyntax("```text\n$L$\n```")).toBe(false);
  });

  it("loads the math renderer when math syntax is present", async () => {
    const { container } = render(<MemoMarkdownRenderer content="$L$" resolvedMentionUsernames={new Set()} />);

    await waitFor(() => expect(container.querySelector(".katex")).not.toBeNull());
  });

  it("escapes plain code and highlights common languages", async () => {
    expect(await highlightCode('<script data-test="x">&</script>', "")).toBe(
      "&lt;script data-test=&quot;x&quot;&gt;&amp;&lt;/script&gt;",
    );
    expect(await highlightCode("echo hello", "bash")).toContain("hljs-built_in");
    expect(await highlightCode("const value = 1;", "js")).toContain("hljs-keyword");
  });
});
