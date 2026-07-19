import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoMarkdownRenderer } from "@/components/MemoContent/MemoMarkdownRenderer";
import { hasMathSyntax } from "@/components/MemoContent/math";

vi.mock("@/components/MemoContent/math", () => ({
  hasMathSyntax: vi.fn(() => false),
}));

describe("<MemoMarkdownRenderer /> memoization", () => {
  beforeEach(() => {
    vi.mocked(hasMathSyntax).mockClear();
  });

  it("does not parse again when only the resolved mention Set identity changes", () => {
    const { rerender } = render(
      <MemoMarkdownRenderer content="Hello @alice" memoName="memos/1" resolvedMentionUsernames={new Set(["alice"])} />,
    );

    rerender(<MemoMarkdownRenderer content="Hello @alice" memoName="memos/1" resolvedMentionUsernames={new Set(["alice"])} />);

    expect(hasMathSyntax).toHaveBeenCalledTimes(1);
  });

  it("renders again when the relevant resolved mentions change", () => {
    const { rerender } = render(
      <MemoMarkdownRenderer content="Hello @alice" memoName="memos/1" resolvedMentionUsernames={new Set<string>()} />,
    );

    rerender(<MemoMarkdownRenderer content="Hello @alice" memoName="memos/1" resolvedMentionUsernames={new Set(["alice"])} />);

    expect(hasMathSyntax).toHaveBeenCalledTimes(2);
  });
});
