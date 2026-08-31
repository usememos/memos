import { DirectionProvider } from "@base-ui/react/direction-provider";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

  it("opens submenus toward the inline end in RTL", async () => {
    render(
      <DirectionProvider direction="rtl">
        <DropdownMenu>
          <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>More</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem>Nested action</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      </DirectionProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    const trigger = await screen.findByRole("menuitem", { name: "More" });
    expect(trigger.querySelector("svg")).toHaveClass("ms-auto", "rtl:rotate-180");

    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowLeft" });

    const nestedAction = await screen.findByRole("menuitem", { name: "Nested action" });
    const submenu = nestedAction.closest('[data-slot="dropdown-menu-content"]');
    expect(submenu).toHaveAttribute("data-side", "inline-end");
    expect(submenu).toHaveClass(
      "data-[side=inline-end]:data-starting-style:-translate-x-2",
      "rtl:data-[side=inline-end]:data-starting-style:translate-x-2",
    );
  });
});
