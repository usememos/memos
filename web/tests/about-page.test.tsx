import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TILE_SPRITES } from "@/components/Placeholder/tileSprites";
import About from "@/pages/About";

describe("<About>", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-theme");
  });

  it("renders the product story and current bird sprites", () => {
    render(<About />);

    expect(screen.getByRole("heading", { name: "Memos" })).toBeInTheDocument();
    expect(screen.getByText(/Capture first/i)).toBeInTheDocument();
    expect(screen.getByText(/quick capture/i)).toBeInTheDocument();

    const sponsors = screen.getByRole("region", { name: "Sponsors" });
    expect(within(sponsors).getByRole("link", { name: /CodeRabbit/i })).toHaveAttribute("href", "https://coderabbit.link/usememos");
    expect(within(sponsors).getByRole("link", { name: /Warp/i })).toHaveAttribute("href", "https://go.warp.dev/memos");
    expect(within(sponsors).getByText(/Cut code review time/i)).toBeInTheDocument();
    expect(within(sponsors).getByText(/agentic development environment/i)).toBeInTheDocument();
    expect(within(sponsors).getByAltText("CodeRabbit").closest("a")).toHaveAttribute("href", "https://coderabbit.link/usememos");
    expect(
      within(sponsors)
        .getByText(/Cut code review time/i)
        .closest("a"),
    ).toHaveAttribute("href", "https://coderabbit.link/usememos");
    expect(within(sponsors).getByAltText("Warp").closest("a")).toHaveAttribute("href", "https://go.warp.dev/memos");
    expect(
      within(sponsors)
        .getByText(/agentic development environment/i)
        .closest("a"),
    ).toHaveAttribute("href", "https://go.warp.dev/memos");

    const birds = screen.getByRole("region", { name: "Birds" });
    expect(within(birds).getAllByTestId("about-bird-sprite")).toHaveLength(TILE_SPRITES.length);

    for (const sprite of TILE_SPRITES) {
      expect(within(birds).getByText(sprite.name)).toBeInTheDocument();
    }
  });

  it("uses dark sponsor logos when the app theme is dark", () => {
    document.documentElement.setAttribute("data-theme", "default-dark");

    render(<About />);

    expect(screen.getByAltText("CodeRabbit")).toHaveAttribute(
      "src",
      "https://victorious-bubble-f69a016683.media.strapiapp.com/White_Typemark_79b9189d19.svg",
    );
    expect(screen.getByAltText("Warp")).toHaveAttribute(
      "src",
      "https://raw.githubusercontent.com/warpdotdev/brand-assets/refs/heads/main/Logos/Warp-Wordmark-White.png",
    );
  });
});
