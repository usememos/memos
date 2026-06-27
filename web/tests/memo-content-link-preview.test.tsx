import { render, screen } from "@testing-library/react";
import type { Element } from "hast";
import { describe, expect, it, vi } from "vitest";
import { Paragraph } from "@/components/MemoContent/markdown/Paragraph";

const viewState = vi.hoisted(() => ({ linkPreview: true }));

// Paragraph reads the global preference via this hook.
vi.mock("@/contexts/ViewContext", () => ({
  useLinkPreviewEnabled: () => viewState.linkPreview,
}));

// The link-preview card fetches metadata via this hook; stub it so the card would
// render whenever it is allowed to.
vi.mock("@/hooks/useMemoQueries", () => ({
  useLinkMetadata: () => ({
    data: { url: "https://example.com", title: "Example Title", description: "An example site", image: "" },
    isSuccess: true,
  }),
}));

// A single bare-link paragraph node, the shape that triggers a preview card.
const singleLinkNode = {
  type: "element",
  tagName: "p",
  properties: {},
  children: [
    {
      type: "element",
      tagName: "a",
      properties: { href: "https://example.com" },
      children: [{ type: "text", value: "https://example.com" }],
    },
  ],
} as unknown as Element;

const renderParagraph = () =>
  render(
    <Paragraph node={singleLinkNode}>
      <a href="https://example.com">https://example.com</a>
    </Paragraph>,
  );

describe("<Paragraph /> link preview gating", () => {
  it("renders the link preview card when the setting is enabled (default)", () => {
    viewState.linkPreview = true;
    renderParagraph();
    expect(screen.getByText("Example Title")).toBeInTheDocument();
  });

  it("renders the plain link without a card when the setting is disabled", () => {
    viewState.linkPreview = false;
    renderParagraph();
    expect(screen.queryByText("Example Title")).not.toBeInTheDocument();
    expect(screen.getByText("https://example.com")).toBeInTheDocument();
  });
});
