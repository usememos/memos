import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const options = [
  { value: "standard", label: "Standard" },
  { value: "wide", label: "Wide" },
];

describe("<Select>", () => {
  it("places its portal positioner at the dropdown stacking tier", () => {
    render(
      <Select open value="standard" items={options}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>,
    );

    expect(screen.getByText("Wide")).toBeInTheDocument();
    expect(document.querySelector('[data-slot="select-positioner"]')).toHaveClass("isolate", "z-dropdown");
  });
});
