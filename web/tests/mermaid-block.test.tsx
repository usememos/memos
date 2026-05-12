import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MermaidBlock } from "@/components/MemoContent/MermaidBlock";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    userGeneralSetting: { theme: "default" },
  }),
}));

const renderMermaid = vi.fn(async () => ({ svg: '<svg data-testid="diagram"></svg>' }));
const initializeMermaid = vi.fn();

vi.mock("mermaid", () => ({
  default: {
    initialize: initializeMermaid,
    render: renderMermaid,
  },
}));

const codeElement = (content: string) => <code className="language-mermaid">{content}</code>;

describe("MermaidBlock", () => {
  it("clears rendered output when code content becomes empty", async () => {
    const { container, rerender } = render(<MermaidBlock>{codeElement("graph TD; A-->B")}</MermaidBlock>);

    await waitFor(() => expect(container.querySelector(".mermaid-diagram")).not.toBeNull());

    rerender(<MermaidBlock>{codeElement("")}</MermaidBlock>);

    await waitFor(() => expect(container.querySelector(".mermaid-diagram")).toBeNull());
  });
});
