import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Placeholder from "@/components/Placeholder";

describe("<Placeholder>", () => {
  it.each(["memo", "search", "inbox"] as const)("renders the %s scene as decorative artwork", (scene) => {
    render(<Placeholder scene={scene} message="No data found." />);

    const illustration = screen.getByTestId("placeholder-illustration");
    expect(illustration).toHaveAttribute("data-scene", scene);
    expect(illustration).toHaveAttribute("aria-hidden", "true");
    expect(illustration).toHaveAttribute("viewBox", "0 0 560 280");
    expect(screen.getByText("No data found.")).toBeInTheDocument();
  });

  it("merges layout classes from its caller", () => {
    const { container } = render(<Placeholder scene="memo" message="Nothing here" className="w-full" />);
    expect(container.firstChild).toHaveClass("w-full");
  });
});
