import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Placeholder from "@/components/Placeholder";
import { DEFAULT_MESSAGES } from "@/components/Placeholder/messages";

describe("<Placeholder>", () => {
  it("renders the default message for variant=empty", () => {
    render(<Placeholder variant="empty" />);
    expect(screen.getByText(DEFAULT_MESSAGES.empty)).toBeInTheDocument();
  });

  it("renders the default message for variant=loading", () => {
    render(<Placeholder variant="loading" />);
    expect(screen.getByText(DEFAULT_MESSAGES.loading)).toBeInTheDocument();
  });

  it("renders the default message for variant=noResults", () => {
    render(<Placeholder variant="noResults" />);
    expect(screen.getByText(DEFAULT_MESSAGES.noResults)).toBeInTheDocument();
  });

  it("renders the default message for variant=notFound", () => {
    render(<Placeholder variant="notFound" />);
    expect(screen.getByText(DEFAULT_MESSAGES.notFound)).toBeInTheDocument();
  });

  it("overrides the default message when `message` prop is passed", () => {
    render(<Placeholder variant="empty" message="Custom copy goes here" />);
    expect(screen.getByText("Custom copy goes here")).toBeInTheDocument();
    expect(screen.queryByText(DEFAULT_MESSAGES.empty)).not.toBeInTheDocument();
  });

  it("renders the ASCII art inside a <pre> with aria-hidden", () => {
    const { container } = render(<Placeholder variant="empty" />);
    const pre = container.querySelector("pre");
    expect(pre).not.toBeNull();
    expect(pre).toHaveAttribute("aria-hidden", "true");
    expect(pre!.textContent!.length).toBeGreaterThan(0);
  });

  it("does not render the credit string in the UI (attribution lives in CREDITS.md)", () => {
    render(<Placeholder variant="empty" />);
    expect(screen.queryByText(/jgs/)).not.toBeInTheDocument();
  });

  it('applies role="status" and aria-live="polite" ONLY when variant=loading', () => {
    const { rerender, container } = render(<Placeholder variant="empty" />);
    expect(container.querySelector('[role="status"]')).toBeNull();

    rerender(<Placeholder variant="loading" />);
    const live = container.querySelector('[role="status"]');
    expect(live).not.toBeNull();
    expect(live).toHaveAttribute("aria-live", "polite");
  });

  it("renders children below the message when provided", () => {
    render(
      <Placeholder variant="notFound">
        <button type="button">Go home</button>
      </Placeholder>,
    );
    expect(screen.getByRole("button", { name: "Go home" })).toBeInTheDocument();
  });

  it("merges a custom className onto the outer wrapper", () => {
    const { container } = render(<Placeholder variant="empty" className="custom-test-class" />);
    expect(container.firstChild).toHaveClass("custom-test-class");
  });
});
