import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SIDEBAR_ROW_COUNT_RAIL_CLASSES } from "@/components/AppSidebar/SidebarRow";
import TagTree from "@/components/TagTree";

vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));

const storedExpansion = (scope = "home") => JSON.parse(localStorage.getItem(`tag-tree-expanded:${scope}`) ?? "null");

describe("TagTree rendering", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts collapsed and expands via the disclosure chevron", () => {
    render(
      <TagTree
        tagAmounts={[
          ["a", 2],
          ["a/b", 1],
          ["getting-started", 1],
        ]}
        scope="home"
        onTagClick={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("treeitem")).toHaveLength(2);
    expect(screen.queryByText("b")).not.toBeInTheDocument();

    const disclosure = screen.getByLabelText("common.expand #a");
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(disclosure);
    expect(screen.getByText("b")).toBeVisible();
    expect(storedExpansion().expanded).toEqual(["a"]);
    expect(screen.getByLabelText("common.collapse #a")).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByLabelText("common.collapse #a"));
    expect(screen.queryByText("b")).not.toBeInTheDocument();
  });

  it("filters on the full path when a nested tag is clicked", () => {
    const onTagClick = vi.fn();
    render(
      <TagTree
        tagAmounts={[
          ["a", 2],
          ["a/b", 1],
        ]}
        scope="home"
        onTagClick={onTagClick}
      />,
    );

    fireEvent.click(screen.getByLabelText("common.expand #a"));
    fireEvent.click(screen.getByText("b").closest("button") as HTMLButtonElement);
    expect(onTagClick).toHaveBeenCalledWith("a/b");
  });

  it("filters on tag label click without toggling the branch", () => {
    const onTagClick = vi.fn();
    render(
      <TagTree
        tagAmounts={[
          ["a", 2],
          ["a/b", 1],
        ]}
        scope="home"
        onTagClick={onTagClick}
      />,
    );

    fireEvent.click(screen.getByText("a").closest("button") as HTMLButtonElement);
    expect(onTagClick).toHaveBeenCalledWith("a");
    expect(screen.queryByText("b")).not.toBeInTheDocument();
  });

  it("puts disclosures before labels and keeps counts in a fixed trailing rail", () => {
    const onTagClick = vi.fn();
    render(
      <TagTree
        tagAmounts={[
          ["a", 12],
          ["a/b", 1],
          ["getting-started", 3],
        ]}
        scope="home"
        onTagClick={onTagClick}
      />,
    );

    const branch = screen.getByText("a").closest('[role="treeitem"]') as HTMLElement;
    const branchLabelButton = screen.getByText("a").closest("button") as HTMLButtonElement;
    const disclosure = screen.getByLabelText("common.expand #a");
    const branchCount = within(branch).getByText("12");
    expect(disclosure.compareDocumentPosition(branchLabelButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(branchLabelButton).toHaveClass("text-start");
    expect(branchLabelButton.querySelector("svg")).not.toBeInTheDocument();

    // A branch reads as a plain tag at rest: the slot holds the # mark and only swaps in the
    // chevron while the row is hovered or holds focus.
    const [restMark, hoverChevron] = Array.from(disclosure.querySelectorAll("svg"));
    expect(restMark).toHaveClass("group-hover:hidden", "group-has-[:focus-visible]:hidden");
    expect(hoverChevron).toHaveClass("hidden", "group-hover:block", "group-has-[:focus-visible]:block");

    fireEvent.click(disclosure);
    expect(onTagClick).not.toHaveBeenCalled();
    fireEvent.click(branchCount);
    expect(onTagClick).toHaveBeenCalledWith("a");

    const leaf = screen.getByText("getting-started").closest('[role="treeitem"]') as HTMLElement;
    const leafCount = within(leaf).getByText("3");
    expect(within(leaf).getAllByRole("button")).toHaveLength(1);
    expect(screen.getByText("getting-started").closest("button")?.querySelector("svg")).toBeInTheDocument();

    for (const count of [branchCount, leafCount]) {
      expect(count).toHaveClass(...SIDEBAR_ROW_COUNT_RAIL_CLASSES.split(" "));
    }
  });

  it("gives a structural row one control that both labels and toggles it", () => {
    render(<TagTree tagAmounts={[["personal/travel/singapore", 1]]} scope="home" onTagClick={vi.fn()} />);

    // The row is the disclosure, so it is the only tab stop on that line.
    const personalDisclosure = screen.getByLabelText(/common\.(expand|collapse) personal$/);
    expect(personalDisclosure).toHaveAttribute("aria-expanded", "false");
    const personalLabel = screen.getByText("personal");
    const chevron = personalDisclosure.querySelector("svg") as SVGElement;
    expect(chevron.compareDocumentPosition(personalLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(personalDisclosure);
    expect(screen.getByText("travel")).toBeVisible();
    expect(screen.getByLabelText("common.collapse personal")).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByText("travel").closest("button") as HTMLButtonElement);
    expect(screen.getByText("singapore")).toBeVisible();
  });

  it("reveals the ancestors of the active tag", () => {
    render(
      <TagTree
        tagAmounts={[
          ["a", 1],
          ["a/b/c", 1],
        ]}
        activeTag="a/b/c"
        scope="home"
        onTagClick={vi.fn()}
      />,
    );

    expect(screen.getByText("c")).toBeVisible();
    expect(screen.getByText("c").closest('[role="treeitem"]')).toHaveAttribute("aria-selected", "true");
  });

  it("keeps a deliberate collapse across remounts while the filter stays active", () => {
    const tree = (
      <TagTree
        tagAmounts={[
          ["a", 1],
          ["a/b", 1],
        ]}
        activeTag="a/b"
        scope="home"
        onTagClick={vi.fn()}
      />
    );
    const { unmount } = render(tree);

    fireEvent.click(screen.getByLabelText("common.collapse #a"));
    expect(screen.queryByText("b")).not.toBeInTheDocument();
    unmount();

    // The mobile sheet unmounts the sidebar on close, so the reveal effect runs again on reopen.
    render(tree);
    expect(screen.queryByText("b")).not.toBeInTheDocument();
  });

  it("reveals again when the same tag is re-selected after clearing the filter", () => {
    const { rerender } = render(
      <TagTree
        tagAmounts={[
          ["a", 1],
          ["a/b", 1],
        ]}
        activeTag="a/b"
        scope="home"
        onTagClick={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText("common.collapse #a"));

    rerender(
      <TagTree
        tagAmounts={[
          ["a", 1],
          ["a/b", 1],
        ]}
        scope="home"
        onTagClick={vi.fn()}
      />,
    );
    rerender(
      <TagTree
        tagAmounts={[
          ["a", 1],
          ["a/b", 1],
        ]}
        activeTag="a/b"
        scope="home"
        onTagClick={vi.fn()}
      />,
    );

    expect(screen.getByText("b")).toBeVisible();
  });

  it("keeps expansion state separate per scope", () => {
    const { unmount } = render(
      <TagTree
        tagAmounts={[
          ["a", 1],
          ["a/b", 1],
        ]}
        scope="users/alice"
        onTagClick={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText("common.expand #a"));
    expect(screen.getByText("b")).toBeVisible();
    unmount();

    render(
      <TagTree
        tagAmounts={[
          ["a", 1],
          ["a/b", 1],
        ]}
        scope="users/bob"
        onTagClick={vi.fn()}
      />,
    );
    expect(screen.queryByText("b")).not.toBeInTheDocument();
    expect(storedExpansion("users/alice").expanded).toEqual(["a"]);
  });
});
