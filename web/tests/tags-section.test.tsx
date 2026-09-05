import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SIDEBAR_ROW_BOX_CLASSES, SIDEBAR_ROW_COUNT_RAIL_CLASSES, SIDEBAR_ROW_SLOT_CLASSES } from "@/components/AppSidebar/SidebarRow";
import { SIDEBAR_SECTION_ACTION_BUTTON_CLASSES, SIDEBAR_SECTION_ACTION_ICON_CLASSES } from "@/components/AppSidebar/SidebarSection";
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

    const trigger = screen.getByRole("button", { name: "common.tags: common.more" });
    expect(trigger).toHaveClass(...SIDEBAR_SECTION_ACTION_BUTTON_CLASSES.split(" "));
    expect(trigger.querySelector("svg")).toHaveClass(SIDEBAR_SECTION_ACTION_ICON_CLASSES);
    expect(screen.queryByRole("button", { name: "common.tags: memo.layout-list" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitemcheckbox")).not.toBeInTheDocument();
  });

  it("switches layouts from the menu, closes it, and persists the preference", async () => {
    const onSelect = vi.fn();
    render(
      <MemoryRouter>
        <MemoFilterProvider>
          <TagsSection tagCount={{ a: 2, "a/b": 1 }} scope="home" onSelect={onSelect} />
        </MemoFilterProvider>
      </MemoryRouter>,
    );

    const trigger = screen.getByRole("button", { name: "common.tags: common.more" });
    fireEvent.click(trigger);
    const treeMode = await screen.findByRole("menuitemcheckbox", { name: "common.tree-mode" });
    expect(treeMode).toHaveAttribute("aria-checked", "false");
    fireEvent.click(treeMode);

    expect(screen.getByRole("tree")).toBeInTheDocument();
    expect(localStorage.getItem("tag-view-as-tree")).toBe("true");
    await waitFor(() => expect(screen.queryByRole("menuitemcheckbox")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());

    fireEvent.click(trigger);
    const checkedTreeMode = await screen.findByRole("menuitemcheckbox", { name: "common.tree-mode" });
    expect(checkedTreeMode).toHaveAttribute("aria-checked", "true");
    fireEvent.click(checkedTreeMode);

    expect(screen.queryByRole("tree")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "#a/b, setting.tags.used-count" })).toBeInTheDocument();
    expect(localStorage.getItem("tag-view-as-tree")).toBe("false");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("reflects an existing tree preference when opening the menu", async () => {
    localStorage.setItem("tag-view-as-tree", "true");
    render(
      <MemoryRouter>
        <MemoFilterProvider>
          <TagsSection tagCount={{ a: 2, "a/b": 1 }} scope="home" />
        </MemoFilterProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole("tree")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "common.tags: common.more" }));
    expect(await screen.findByRole("menuitemcheckbox", { name: "common.tree-mode" })).toHaveAttribute("aria-checked", "true");
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
