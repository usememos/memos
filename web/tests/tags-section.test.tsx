import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SIDEBAR_ROW_BOX_CLASSES, SIDEBAR_ROW_COUNT_RAIL_CLASSES, SIDEBAR_ROW_SLOT_CLASSES } from "@/components/AppSidebar/SidebarRow";
import {
  SIDEBAR_SECTION_ACTION_ACTIVE_CLASSES,
  SIDEBAR_SECTION_ACTION_BUTTON_CLASSES,
  SIDEBAR_SECTION_ACTION_ICON_CLASSES,
} from "@/components/AppSidebar/SidebarSection";
import TagsSection from "@/components/AppSidebar/TagsSection";
import { MemoFilterProvider } from "@/contexts/MemoFilterContext";

vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));

describe("TagsSection", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("keeps the title count-free and uses the shared section action grammar", () => {
    render(
      <MemoryRouter>
        <MemoFilterProvider>
          <TagsSection tagCount={{ a: 2, "a/b": 1 }} scope="home" />
        </MemoFilterProvider>
      </MemoryRouter>,
    );

    const heading = screen.getByRole("heading", { name: "common.tags", level: 2 });
    expect(heading.parentElement).toHaveTextContent(/^common.tags$/);

    const listButton = screen.getByRole("button", { name: "common.tags: memo.layout-list" });
    const treeButton = screen.getByRole("button", { name: "common.tags: common.tree-mode" });
    const stableActionClasses = SIDEBAR_SECTION_ACTION_BUTTON_CLASSES.split(" ").filter(
      (className) => className !== "text-muted-foreground/65",
    );
    for (const button of [listButton, treeButton]) {
      expect(button).toHaveClass(...stableActionClasses);
      expect(button.querySelector("svg")).toHaveClass(SIDEBAR_SECTION_ACTION_ICON_CLASSES);
    }
    expect(listButton).toHaveClass(...SIDEBAR_SECTION_ACTION_ACTIVE_CLASSES.split(" "));
    expect(treeButton).toHaveClass("text-muted-foreground/65");

    fireEvent.click(treeButton);
    expect(treeButton).toHaveClass(...SIDEBAR_SECTION_ACTION_ACTIVE_CLASSES.split(" "));
    expect(listButton).not.toHaveClass(...SIDEBAR_SECTION_ACTION_ACTIVE_CLASSES.split(" "));
    expect(listButton).toHaveClass("text-muted-foreground/65");
  });

  it("keeps flat rows on the shared row grammar with a trailing count rail", () => {
    render(
      <MemoryRouter>
        <MemoFilterProvider>
          <TagsSection tagCount={{ alpha: 2, "a/very-long-tag-path": 1 }} scope="home" />
        </MemoFilterProvider>
      </MemoryRouter>,
    );

    const alpha = screen.getByText("alpha");
    const alphaButton = alpha.closest("button") as HTMLButtonElement;
    const path = alpha.parentElement?.parentElement as HTMLSpanElement;
    const count = screen.getByText("2");

    expect(alphaButton).toHaveClass(...SIDEBAR_ROW_BOX_CLASSES.split(" "));
    // The # sits in the same fixed slot the tree uses, so switching modes keeps it in place.
    expect(alphaButton.firstElementChild).toHaveClass(...SIDEBAR_ROW_SLOT_CLASSES.split(" "));
    expect(path).toHaveClass("truncate", "text-start");
    expect(path).not.toContainElement(count);
    expect(count).toHaveClass(...SIDEBAR_ROW_COUNT_RAIL_CLASSES.split(" "));
  });
});
