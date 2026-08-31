import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Switch } from "@/components/ui/switch";

describe("Switch", () => {
  it("moves the checked thumb toward the inline end in both text directions", () => {
    render(<Switch aria-label="Example setting" defaultChecked />);

    const root = screen.getByRole("switch", { name: "Example setting" });
    const thumb = root.querySelector('[data-slot="switch-thumb"]');

    expect(root).toHaveAttribute("aria-checked", "true");
    expect(thumb).toHaveAttribute("data-checked");
    expect(thumb).toHaveClass("data-checked:translate-x-[calc(100%-2px)]", "rtl:data-checked:-translate-x-[calc(100%-2px)]");
  });
});
