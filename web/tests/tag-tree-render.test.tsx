import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TagTree from "@/components/TagTree";

vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));

describe("TagTree rendering", () => {
  it("shows every nested tag without disclosure icons", () => {
    const onTagClick = vi.fn();
    const { container } = render(
      <TagTree
        tagAmounts={[
          ["a", 2],
          ["a/b", 1],
          ["getting-started", 1],
        ]}
        onTagClick={onTagClick}
      />,
    );

    expect(screen.getAllByRole("treeitem")).toHaveLength(3);
    expect(screen.getByText("b")).toBeVisible();
    expect(container.querySelectorAll("svg.lucide-hash")).toHaveLength(3);
    expect(container.querySelector("svg.lucide-chevron-right")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("b").closest("button") as HTMLButtonElement);
    expect(onTagClick).toHaveBeenCalledWith("a/b");
  });
});
