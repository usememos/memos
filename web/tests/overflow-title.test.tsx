import { render, screen } from "@testing-library/react";
import { useLayoutEffect } from "react";
import { describe, expect, it } from "vitest";
import { useOverflowTitle } from "@/hooks/useOverflowTitle";

interface HarnessProps {
  text: string;
  scrollWidth: number;
  clientWidth: number;
}

const Harness = ({ text, scrollWidth, clientWidth }: HarnessProps) => {
  const { ref, title } = useOverflowTitle<HTMLSpanElement>(text);

  useLayoutEffect(() => {
    if (!ref.current) return;
    Object.defineProperties(ref.current, {
      scrollWidth: { configurable: true, value: scrollWidth },
      clientWidth: { configurable: true, value: clientWidth },
    });
  }, [clientWidth, ref, scrollWidth]);

  return (
    <div data-testid="trigger" title={title}>
      <span ref={ref}>{text}</span>
    </div>
  );
};

describe("useOverflowTitle", () => {
  it("omits the title when the text fits", () => {
    render(<Harness text="Short label" scrollWidth={80} clientWidth={120} />);

    expect(screen.getByTestId("trigger")).not.toHaveAttribute("title");
  });

  it("adds the title when the text is truncated", async () => {
    render(<Harness text="A label that is too long" scrollWidth={180} clientWidth={80} />);

    expect(await screen.findByTitle("A label that is too long")).toBeInTheDocument();
  });
});
