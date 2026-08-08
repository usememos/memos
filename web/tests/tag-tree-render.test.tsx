import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

  it("gives a structural row one control that both labels and toggles it", () => {
    render(<TagTree tagAmounts={[["personal/travel/singapore", 1]]} scope="home" onTagClick={vi.fn()} />);

    // The row is the disclosure, so it is the only tab stop on that line.
    const personalDisclosure = screen.getByLabelText(/common\.(expand|collapse) personal$/);
    expect(personalDisclosure).toHaveAttribute("aria-expanded", "false");

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
