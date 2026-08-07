import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SidebarRow, { SIDEBAR_ROW_BOX_CLASSES } from "@/components/AppSidebar/SidebarRow";
import TagTree from "@/components/TagTree";

vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));

/**
 * Tag rows drifted off the rail's row grammar once already (they were 26px/12px against
 * everything else's 30px/13px). These lock the shared box: the sizes must come from
 * `SIDEBAR_ROW_BOX_CLASSES`, not from values copied into each list.
 */
const boxClasses = SIDEBAR_ROW_BOX_CLASSES.split(" ");

describe("sidebar row grammar", () => {
  it("gives a nav row the shared row box", () => {
    render(<SidebarRow icon={() => null} label="Tasks" />);

    expect(screen.getByRole("button", { name: "Tasks" })).toHaveClass(...boxClasses);
  });

  it("gives tag tree rows the same box as a nav row", () => {
    render(
      <TagTree
        tagAmounts={[
          ["a", 2],
          ["a/b", 1],
        ]}
        scope="home"
        onTagClick={vi.fn()}
      />,
    );

    for (const item of screen.getAllByRole("treeitem")) {
      expect(item).toHaveClass(...boxClasses);
    }
  });

  it("indents nested tags by the same step the memo outline uses", () => {
    render(
      <TagTree
        tagAmounts={[
          ["a", 2],
          ["a/b", 1],
        ]}
        // The active tag keeps the nested row expanded into view.
        activeTag="a/b"
        scope="home"
        onTagClick={vi.fn()}
      />,
    );

    const [root, child] = screen.getAllByRole("treeitem");
    expect(root).toHaveStyle({ paddingInlineStart: "8px" });
    expect(child).toHaveStyle({ paddingInlineStart: "20px" });
  });
});
