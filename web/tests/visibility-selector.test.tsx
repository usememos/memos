import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import VisibilitySelector from "@/components/MemoEditor/Toolbar/VisibilitySelector";
import { Visibility } from "@/types/proto/api/v1/memo_service_pb";

vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));

// Base UI menus reach for layout/pointer APIs jsdom doesn't implement.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

const openMenu = async (value: Visibility, onChange = vi.fn(), space?: string) => {
  render(<VisibilitySelector value={value} space={space} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button"));
  await screen.findByRole("menu");
  return onChange;
};

describe("VisibilitySelector", () => {
  it("omits the Space audience when the edited memo has no Space placement", async () => {
    await openMenu(Visibility.PRIVATE);

    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "memo.visibility.privatememo.visibility.private-description",
      "memo.visibility.protectedmemo.visibility.protected-description",
      "memo.visibility.publicmemo.visibility.public-description",
    ]);
  });

  it("offers the Space audience with its own description when the edited memo belongs to a Space", async () => {
    await openMenu(Visibility.PRIVATE, vi.fn(), "spaces/product");

    const spaceItem = screen.getByRole("menuitem", { name: /memo\.visibility\.space/ });
    expect(spaceItem).toHaveTextContent("memo.visibility.space-description");
  });

  it("names the current Space audience even when placement is unavailable", () => {
    render(<VisibilitySelector value={Visibility.SPACE} onChange={vi.fn()} />);

    expect(screen.getByRole("button")).toHaveTextContent("memo.visibility.space");
  });

  it("keeps the current Space audience selectable when placement is unavailable", async () => {
    await openMenu(Visibility.SPACE);

    expect(screen.getByRole("menuitem", { name: /memo\.visibility\.space/ })).toBeInTheDocument();
  });

  it("reports the picked audience", async () => {
    const onChange = await openMenu(Visibility.PRIVATE);

    fireEvent.click(screen.getByRole("menuitem", { name: /memo\.visibility\.public/ }));

    expect(onChange).toHaveBeenCalledWith(Visibility.PUBLIC);
  });
});
