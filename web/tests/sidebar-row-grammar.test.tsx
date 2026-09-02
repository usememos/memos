import { render, screen } from "@testing-library/react";
import { HashIcon } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import SidebarRow, {
  SIDEBAR_ROW_BOX_CLASSES,
  SIDEBAR_ROW_COUNT_RAIL_CLASSES,
  SIDEBAR_ROW_SLOT_BUTTON_CLASSES,
  SIDEBAR_ROW_SLOT_CLASSES,
} from "@/components/AppSidebar/SidebarRow";
import SidebarSection, {
  SIDEBAR_SECTION_ACTION_BUTTON_CLASSES,
  SIDEBAR_SECTION_CONTENT_CLASSES,
} from "@/components/AppSidebar/SidebarSection";
import TagTree from "@/components/TagTree";

vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));

/**
 * Tag rows drifted off the rail's row grammar once already (they were 26px/12px against
 * everything else's 30px/13px). These lock the shared box: the sizes must come from
 * `SIDEBAR_ROW_BOX_CLASSES`, not from values copied into each list.
 */
const boxClasses = SIDEBAR_ROW_BOX_CLASSES.split(" ");

describe("sidebar row grammar", () => {
  it("gives every content section the same title and row rhythm", () => {
    render(
      <SidebarSection label="Statistics">
        <SidebarRow label="August 2026" />
      </SidebarSection>,
    );

    expect(screen.getByRole("heading", { name: "Statistics", level: 2 })).toHaveClass("text-2xs", "font-normal");
    expect(screen.getByRole("button", { name: "August 2026" }).parentElement).toHaveClass(...SIDEBAR_SECTION_CONTENT_CLASSES.split(" "));
  });

  it("gives a nav row the shared row box", () => {
    render(<SidebarRow icon={HashIcon} label="Tasks" count={3} />);

    const row = screen.getByRole("button", { name: "Tasks3" });
    expect(row).toHaveClass(...boxClasses);
    expect(row).toHaveClass("h-7", "w-full", "gap-1", "rounded-md", "px-2");
    expect(row).not.toHaveClass("-mx-1");
    // Icon in the shared slot and count in the shared rail, so every list — nav rows,
    // views, tags in both modes — keeps its icons and digits on the same vertical lines.
    expect(row.firstElementChild).toHaveClass(...SIDEBAR_ROW_SLOT_CLASSES.split(" "));
    expect(row.firstElementChild).toHaveClass("size-5");
    expect(row.firstElementChild?.firstElementChild).toHaveClass("size-4");
    expect(screen.getByText("3")).toHaveClass(...SIDEBAR_ROW_COUNT_RAIL_CLASSES.split(" "));
  });

  it("keeps compact controls at a 24px hit target without layout margins", () => {
    expect(SIDEBAR_ROW_SLOT_BUTTON_CLASSES).toContain("after:-inset-0.5");
    expect(SIDEBAR_ROW_SLOT_BUTTON_CLASSES).toContain("after:content-['']");
    expect(SIDEBAR_ROW_SLOT_BUTTON_CLASSES).not.toContain("-mx-1");
    expect(SIDEBAR_SECTION_ACTION_BUTTON_CLASSES.split(" ")).toContain("size-6");
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
    expect(document.querySelector(".lucide-chevron-right")).toHaveClass("me-auto");
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
