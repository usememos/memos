import { render, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { highlightCode } from "@/components/MemoContent/highlight";
import MathMarkdownRenderer from "@/components/MemoContent/MathMarkdownRenderer";
import { MemoMarkdownRenderer } from "@/components/MemoContent/MemoMarkdownRenderer";
import { hasMathSyntax } from "@/components/MemoContent/math";

const ISSUE_CURRENCY_CONTENT = `list of 10 houses
$140,000 max - buffer of ~10k
diy, add amount to down payment
no appliances covered
less than $1,000, client responsibilities
over $1,000 - owner responsibility
vacant is good to rent
for sale by owner
path to ownership -$50
rent insurance - my of`;

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

  it("keeps currency dollars literal across and within lines", () => {
    const content = `${ISSUE_CURRENCY_CONTENT}\n\n$20,000 and $30,000`;
    const { container } = render(<MathMarkdownRenderer content={content} resolvedMentionUsernames={new Set()} />);

    expect(container.querySelector(".katex")).toBeNull();
    expect(container.querySelectorAll("br")).toHaveLength(9);
    for (const price of ["$140,000", "$1,000", "$50", "$20,000", "$30,000"]) {
      expect(container.textContent).toContain(price);
    }
  });

  it("retries later dollars after rejecting currency and preserves display math", () => {
    const inline = render(<MathMarkdownRenderer content="A $5 amount and $x$" resolvedMentionUsernames={new Set()} />);
    expect(inline.container.textContent).toContain("A $5 amount and ");
    expect(inline.container.querySelectorAll(".katex")).toHaveLength(1);

    const multiline = render(<MathMarkdownRenderer content={"$x +\ny$"} resolvedMentionUsernames={new Set()} />);
    expect(multiline.container.querySelector(".katex")).not.toBeNull();

    const display = render(<MathMarkdownRenderer content={"$$\nx + y\n$$"} resolvedMentionUsernames={new Set()} />);
    expect(display.container.querySelector(".katex-display .katex")).not.toBeNull();
  });

  it.each([
    "$ x$",
    "$x $",
    "$x$2",
    "$\u00a0x$",
    "$x\u00a0$",
    "$\u0085x$",
    "$x\u0085$",
  ])("keeps invalid single-dollar boundaries literal: %s", (content) => {
    const { container } = render(<MathMarkdownRenderer content={content} resolvedMentionUsernames={new Set()} />);

    expect(container.querySelector(".katex")).toBeNull();
    expect(container.textContent).toBe(content);
  });

  it.each([
    ["$x $ and $y$", "$x $ and "],
    ["$x$2 and $y$", "$x$2 and "],
    ["$20 and $30 then $x$", "$20 and $30 then "],
  ])("abandons an invalid closer before parsing later math: %s", (content, literalPrefix) => {
    const { container } = render(<MathMarkdownRenderer content={content} resolvedMentionUsernames={new Set()} />);

    expect(container.textContent).toContain(literalPrefix);
    expect(container.querySelectorAll(".katex")).toHaveLength(1);
  });

  it("renders escaped currency without the Markdown escape", () => {
    const { container } = render(<MathMarkdownRenderer content={String.raw`Price is \$20`} resolvedMentionUsernames={new Set()} />);

    expect(container.querySelector(".katex")).toBeNull();
    expect(container.textContent).toBe("Price is $20");
  });

  it("escapes plain code and highlights common languages", async () => {
    expect(await highlightCode('<script data-test="x">&</script>', "")).toBe(
      "&lt;script data-test=&quot;x&quot;&gt;&amp;&lt;/script&gt;",
    );
    expect(await highlightCode("echo hello", "bash")).toContain("hljs-built_in");
    expect(await highlightCode("const value = 1;", "js")).toContain("hljs-keyword");
  });
});
