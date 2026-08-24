import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import VisibilitySelector from "@/components/MemoEditor/Toolbar/VisibilitySelector";
import { Visibility } from "@/types/proto/api/v1/memo_service_pb";

const space = vi.hoisted(() => ({ selectedSpaceName: undefined as string | undefined }));

vi.mock("@/contexts/SpaceContext", () => ({
  useSpaceContext: () => ({ selectedSpaceName: space.selectedSpaceName }),
}));

vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));

// Base UI menus reach for layout/pointer APIs jsdom doesn't implement.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

const openMenu = async (value: Visibility, onChange = vi.fn()) => {
  render(<VisibilitySelector value={value} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button"));
  await screen.findByRole("menu");
  return onChange;
};

describe("VisibilitySelector", () => {
  beforeEach(() => {
    space.selectedSpaceName = undefined;
  });

  it("omits the Space audience outside a Space", async () => {
    await openMenu(Visibility.PRIVATE);

    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "memo.visibility.privatememo.visibility.private-description",
      "memo.visibility.protectedmemo.visibility.protected-description",
      "memo.visibility.publicmemo.visibility.public-description",
    ]);
  });

  it("offers the Space audience with its own description while a Space is selected", async () => {
    space.selectedSpaceName = "spaces/product";
    await openMenu(Visibility.PRIVATE);

    const spaceItem = screen.getByRole("menuitem", { name: /memo\.visibility\.space/ });
    expect(spaceItem).toHaveTextContent("memo.visibility.space-description");
  });

  it("names a Space memo's audience on the trigger even outside its Space", () => {
    render(<VisibilitySelector value={Visibility.SPACE} onChange={vi.fn()} />);

    expect(screen.getByRole("button")).toHaveTextContent("memo.visibility.space");
  });

  it("keeps a Space memo's own audience selectable outside its Space", async () => {
    await openMenu(Visibility.SPACE);

    expect(screen.getByRole("menuitem", { name: /memo\.visibility\.space/ })).toBeInTheDocument();
  });

  it("reports the picked audience", async () => {
    const onChange = await openMenu(Visibility.PRIVATE);

    fireEvent.click(screen.getByRole("menuitem", { name: /memo\.visibility\.public/ }));

    expect(onChange).toHaveBeenCalledWith(Visibility.PUBLIC);
  });
});
