import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TILE_SPRITES } from "@/components/Placeholder/tileSprites";
import About from "@/pages/About";

describe("<About>", () => {
  it("renders the product story and current bird sprites", () => {
    render(<About />);

    expect(screen.getByRole("heading", { name: "Memos" })).toBeInTheDocument();
    expect(screen.getByText(/Capture first/i)).toBeInTheDocument();
    expect(screen.getByText(/quick capture/i)).toBeInTheDocument();

    const birds = screen.getByRole("region", { name: "Birds" });
    expect(within(birds).getAllByTestId("about-bird-sprite")).toHaveLength(TILE_SPRITES.length);

    for (const sprite of TILE_SPRITES) {
      expect(within(birds).getByText(sprite.name)).toBeInTheDocument();
    }
  });
});
