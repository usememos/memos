import { DirectionProvider } from "@base-ui/react/direction-provider";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MemoDisplaySettingMenu from "@/components/MemoDisplaySettingMenu";
import { ViewProvider } from "@/contexts/ViewContext";

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string, params?: Record<string, number>) => {
    const labels: Record<string, string> = {
      "common.timeline": "Timeline",
      "common.created-at": "Created",
      "common.last-updated-at": "Last updated",
      "memo.compact-mode": "Compact mode",
      "memo.direction": "Direction",
      "memo.layout": "Layout",
      "memo.layout-auto": "Auto",
      "memo.layout-auto-description": "As many columns as fit",
      "memo.layout-columns-description": `Up to ${params?.n ?? ""} columns`,
      "memo.layout-list": "List",
      "memo.layout-list-description": "A single column",
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

  it("opens from an accessible trigger and holds only the Timeline's own options", () => {
    render(
      <ViewProvider>
        <MemoDisplaySettingMenu />
      </ViewProvider>,
    );

    const trigger = screen.getByRole("button", { name: "Timeline · View options" });
    expect(trigger).toHaveClass("mu-button", "mu-button-ghost", "mu-s-md", "w-auto", "px-1.5", "rounded-s-none");
    expect(trigger.querySelector(".lucide-chevron-down")).toBeInTheDocument();
    expect(trigger.querySelector("svg")).toHaveClass("mu-icon-sm");

    fireEvent.click(trigger);

    expect(screen.getByRole("group", { name: "Layout" })).toHaveClass("mu-s-md");
    // Each option is a horizontal Field: its label names the Select or Switch at the end of the row.
    expect(screen.getByRole("combobox", { name: "Order by" })).toHaveTextContent("Created");
    expect(screen.getByRole("combobox", { name: "Direction" })).toHaveTextContent("Newest first");
    // Choices that apply to every memo list live in Settings, not in the Timeline's options.
    expect(screen.queryByRole("switch", { name: "Compact mode" })).not.toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "memo.include-comments" })).not.toBeInTheDocument();
  });

  it("keeps Full width with the layout and explains why Auto locks it", () => {
    render(
      <ViewProvider>
        <MemoDisplaySettingMenu />
      </ViewProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Timeline · View options" }));

    const layout = screen.getByRole("group", { name: "Layout" });
    const fullWidth = screen.getByRole("switch", { name: "memo.full-width" });
    const orderBy = screen.getByRole("combobox", { name: "Order by" });
    // Layout, then Full width, then the sort options.
    expect(layout.compareDocumentPosition(fullWidth) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(fullWidth.compareDocumentPosition(orderBy) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(fullWidth).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByText("memo.full-width-auto-hint")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Auto" }));

    expect(fullWidth).toHaveAttribute("aria-checked", "true");
    expect(fullWidth).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("memo.full-width-auto-hint")).toBeInTheDocument();
  });

  it("opens only from the arrow, not the adjacent Timeline link", () => {
    render(
      <ViewProvider>
        <div>
          <a href="#timeline">Timeline</a>
          <MemoDisplaySettingMenu />
        </div>
      </ViewProvider>,
    );
    const trigger = screen.getByRole("button", { name: "Timeline · View options" });
    fireEvent.click(screen.getByRole("link", { name: "Timeline" }));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("group", { name: "Layout" })).not.toBeInTheDocument();
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("group", { name: "Layout" })).toBeInTheDocument();
  });

  it("moves focus in the visual direction for RTL layouts", async () => {
    render(
      <DirectionProvider direction="rtl">
        <ViewProvider>
          <MemoDisplaySettingMenu />
        </ViewProvider>
      </DirectionProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Timeline · View options" }));
    const list = screen.getByRole("button", { name: "List" });
    act(() => list.focus());
    fireEvent.keyDown(list, { key: "ArrowLeft" });

    await waitFor(() => expect(screen.getByRole("button", { name: "2 columns" })).toHaveFocus());
  });
});
