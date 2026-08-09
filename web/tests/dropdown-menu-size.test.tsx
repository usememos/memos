import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

describe("DropdownMenu sizing", () => {
  it("applies compact content and item density through the sm size", async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent size="sm">
          <DropdownMenuItem>Edit</DropdownMenuItem>
          <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Actions" }));

    const menu = await screen.findByRole("menu");
    expect(menu).toHaveAttribute("data-size", "sm");
    expect(menu).toHaveClass("min-w-24", "rounded", "p-0.5", "shadow-sm");

    for (const item of screen.getAllByRole("menuitem")) {
      expect(item).toHaveClass("min-h-7", "px-2", "py-1", "text-ui");
    }
    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveAttribute("data-variant", "destructive");
  });
});
