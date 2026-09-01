import { DirectionProvider } from "@base-ui/react/direction-provider";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SIDEBAR_SECTION_ACTION_BUTTON_CLASSES, SIDEBAR_SECTION_ACTION_ICON_CLASSES } from "@/components/AppSidebar/SidebarSection";
import MemoDisplaySettingMenu from "@/components/MemoDisplaySettingMenu";
import { ViewProvider } from "@/contexts/ViewContext";

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string, params?: Record<string, number>) => {
    const labels: Record<string, string> = {
      "common.created-at": "Created",
      "common.last-updated-at": "Last updated",
      "memo.compact-mode": "Compact mode",
      "memo.direction": "Direction",
      "memo.grid-compact-hint": "Grid layouts always use compact cards.",
      "memo.layout": "Layout",
      "memo.column-count": "Columns",
      "memo.layout-auto": "Auto",
      "memo.layout-auto-description": "As many columns as fit",
      "memo.layout-columns-description": `Up to ${params?.n ?? ""} columns`,
      "memo.layout-list": "List",
      "memo.layout-list-description": "A single column",
      "memo.layout-masonry": "Columns",
      "memo.layout-masonry-description": "Balanced masonry columns",
      "memo.layout-bento": "Bento",
      "memo.layout-bento-description": "A bento grid with sized tiles",
      "memo.link-preview": "Link preview",
      "memo.newest-first": "Newest first",
      "memo.oldest-first": "Oldest first",
      "memo.order": "Order",
      "memo.order-by": "Order by",
      "memo.view-options": "View options",
    };
    if (key === "memo.layout-columns") return `${params?.n ?? ""} columns`;
    return labels[key] ?? key;
  },
}));

describe("MemoDisplaySettingMenu", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("opens from an accessible trigger and explains the compact grid constraint", () => {
    render(
      <ViewProvider>
        <MemoDisplaySettingMenu />
      </ViewProvider>,
    );

    const trigger = screen.getByRole("button", { name: "View options" });
    expect(trigger).toHaveClass(...SIDEBAR_SECTION_ACTION_BUTTON_CLASSES.split(" "));
    expect(trigger.querySelector("svg")).toHaveClass(SIDEBAR_SECTION_ACTION_ICON_CLASSES);

    fireEvent.click(trigger);

    const compactMode = screen.getByRole("switch", { name: "Compact mode" });
    expect(compactMode).not.toBeChecked();
    expect(compactMode).toBeEnabled();

    fireEvent.click(screen.getByRole("radio", { name: "Columns" }));
    fireEvent.click(screen.getByRole("radio", { name: "2 columns" }));

    expect(compactMode).toBeChecked();
    expect(compactMode).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Grid layouts always use compact cards.")).toBeInTheDocument();
  });

  it("activates an automatic column count when leaving the flow list mode", () => {
    render(
      <ViewProvider>
        <MemoDisplaySettingMenu />
      </ViewProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "View options" }));

    expect(screen.queryByRole("radiogroup", { name: "Columns" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Bento" }));

    expect(screen.getByRole("radiogroup", { name: "Columns" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Bento" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Auto" })).toBeChecked();
  });

  it("moves horizontally in the visual direction for RTL layouts", () => {
    render(
      <DirectionProvider direction="rtl">
        <ViewProvider>
          <MemoDisplaySettingMenu />
        </ViewProvider>
      </DirectionProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "View options" }));
    fireEvent.keyDown(screen.getByRole("radiogroup", { name: "Layout" }), { key: "ArrowLeft" });

    expect(screen.getByRole("radio", { name: "Columns" })).toBeChecked();
  });
});
