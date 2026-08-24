import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SpaceSwitcher from "@/components/AppSidebar/SpaceSwitcher";

const spaceState = vi.hoisted(() => ({
  spaces: [
    { name: "spaces/product", title: "Product", description: "" },
    { name: "spaces/research", title: "Research", description: "" },
  ],
  selectedSpace: undefined as { name: string; title: string; description: string } | undefined,
  selectedSpaceName: undefined as string | undefined,
  selectMemos: vi.fn(),
  selectSpace: vi.fn(),
}));

vi.mock("@/components/MemosLogo", () => ({
  default: () => <span>Memos</span>,
}));

vi.mock("@/components/CreateSpaceDialog", () => ({
  default: ({ open }: { open: boolean }) => (open ? <div role="dialog">Create Space dialog</div> : null),
}));

vi.mock("@/contexts/SpaceContext", () => ({
  useSpaceContext: () => ({
    ...spaceState,
    isLoadingSpaces: false,
    isSpacesError: false,
  }),
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
}));

describe("SpaceSwitcher", () => {
  beforeEach(() => {
    spaceState.selectedSpace = undefined;
    spaceState.selectedSpaceName = undefined;
    spaceState.selectMemos.mockClear();
    spaceState.selectSpace.mockClear();
  });

  it("lists Memos, every available Space, and the create entry", async () => {
    render(<SpaceSwitcher />);

    fireEvent.click(screen.getByRole("button", { name: "space.switch: common.memos" }));

    expect(await screen.findByRole("menuitemradio", { name: "Memos" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitemradio", { name: "Product" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("menuitemradio", { name: "Research" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "space.create" })).toBeInTheDocument();
  });

  it("marks exactly one context as active", async () => {
    spaceState.selectedSpaceName = "spaces/product";
    spaceState.selectedSpace = spaceState.spaces[0];
    render(<SpaceSwitcher />);

    fireEvent.click(screen.getByRole("button", { name: "space.switch: Product" }));

    const rows = await screen.findAllByRole("menuitemradio");
    expect(rows.map((row) => row.getAttribute("aria-checked"))).toEqual(["false", "true", "false"]);

    // The active row carries the fill; the check is its only indicator.
    const active = screen.getByRole("menuitemradio", { name: "Product" });
    expect(active.className).toContain("bg-accent/60");
    expect(active.querySelector("svg")).not.toBeNull();
    expect(screen.getByRole("menuitemradio", { name: "Research" }).querySelector("svg")).toBeNull();
  });

  it("switches context without navigation and opens Space creation", async () => {
    render(<SpaceSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "space.switch: common.memos" }));
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "Product" }));
    expect(spaceState.selectSpace).toHaveBeenCalledWith(spaceState.spaces[0]);

    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());

    // Selecting Memos is how a signed-in user gets back to the home feed.
    fireEvent.click(screen.getByRole("button", { name: "space.switch: common.memos" }));
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "Memos" }));
    expect(spaceState.selectMemos).toHaveBeenCalledOnce();

    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "space.switch: common.memos" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "space.create" }));
    expect(screen.getByRole("dialog", { name: "" })).toHaveTextContent("Create Space dialog");
  });
});
