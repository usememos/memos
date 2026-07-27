import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

describe("Select", () => {
  it("places the positioner in the dropdown stacking layer", () => {
    const items = [
      { value: "create_time", label: "Created" },
      { value: "update_time", label: "Last updated" },
    ];
    render(
      <Select defaultValue="update_time" items={items}>
        <SelectTrigger aria-label="Shown time">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>,
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Shown time" }));

    const popup = document.querySelector('[data-slot="select-content"]');
    expect(popup).not.toBeNull();
    expect(popup?.parentElement).toHaveClass("isolate", "z-dropdown");
  });
});
