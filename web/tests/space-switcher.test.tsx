import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  default: ({ open, onCreated }: { open: boolean; onCreated?: (space: (typeof spaceState.spaces)[number]) => void }) =>
    open ? (
      <div role="dialog">
        Create Space dialog
        <button type="button" onClick={() => onCreated?.(spaceState.spaces[0])}>
          Complete create
        </button>
      </div>
    ) : null,
}));

vi.mock("@/contexts/SpaceContext", () => ({
  useSpaceContext: () => {
    const duplicateSpaceTitles = new Set(
      spaceState.spaces
        .filter((space, index) => spaceState.spaces.findIndex((candidate) => candidate.title === space.title) !== index)
        .map((space) => space.title),
    );
    return {
      ...spaceState,
      duplicateSpaceTitles,
      isLoadingSpaces: false,
      isSpacesError: false,
    };
  },
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
}));

describe("SpaceSwitcher", () => {
  beforeEach(() => {
    spaceState.spaces = [
      { name: "spaces/product", title: "Product", description: "" },
      { name: "spaces/research", title: "Research", description: "" },
    ];
    spaceState.selectedSpace = undefined;
    spaceState.selectedSpaceName = undefined;
    spaceState.selectMemos.mockClear();
    spaceState.selectSpace.mockClear();
  });

  it("lists Memos, every available Space, and the create entry", async () => {
    render(<SpaceSwitcher />);

    const trigger = screen.getByRole("button", { name: "space.switch: common.memos" });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    expect(await screen.findByRole("menuitemradio", { name: "Memos" })).toHaveAttribute("aria-checked", "true");
    const productRow = screen.getByRole("menuitemradio", { name: "Product" });
    expect(productRow).toHaveAttribute("aria-checked", "false");
    expect(productRow.querySelector(".lucide-astroid")).not.toBeNull();
    expect(screen.getByRole("menuitemradio", { name: "Research" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "space.create" })).toBeInTheDocument();
  });

  it("fits the popup symmetrically inside the sidebar rail", async () => {
    render(
      <aside>
        <SpaceSwitcher />
      </aside>,
    );

    const trigger = screen.getByRole("button", { name: "space.switch: common.memos" });
    const sidebar = trigger.closest("aside");
    expect(sidebar).not.toBeNull();
    vi.spyOn(sidebar as HTMLElement, "getBoundingClientRect").mockReturnValue({ left: 0, right: 223, width: 223 } as DOMRect);
    vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue({ left: 12, right: 143, width: 131 } as DOMRect);

    fireEvent.click(trigger);

    expect(await screen.findByRole("menu")).toHaveStyle({ width: "199px" });
  });

  it("uses the same symmetric popup rail from the opposite inline edge", async () => {
    render(
      <aside>
        <SpaceSwitcher />
      </aside>,
    );

    const trigger = screen.getByRole("button", { name: "space.switch: common.memos" });
    const sidebar = trigger.closest("aside");
    expect(sidebar).not.toBeNull();
    vi.spyOn(sidebar as HTMLElement, "getBoundingClientRect").mockReturnValue({ left: 0, right: 223, width: 223 } as DOMRect);
    vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue({ left: 80, right: 211, width: 131 } as DOMRect);

    fireEvent.click(trigger);

    expect(await screen.findByRole("menu")).toHaveStyle({ width: "199px" });
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
    expect(active.querySelector(".lucide-check")).not.toBeNull();
    expect(screen.getByRole("menuitemradio", { name: "Research" }).querySelector(".lucide-check")).toBeNull();
  });

  it("keeps long titles on a truncated rail and exposes the complete value", async () => {
    const longTitle = "A very long product research and planning space title";
    spaceState.spaces = [{ name: "spaces/product", title: longTitle, description: "" }];
    spaceState.selectedSpaceName = spaceState.spaces[0].name;
    spaceState.selectedSpace = spaceState.spaces[0];
    render(<SpaceSwitcher />);

    const trigger = screen.getByRole("button", { name: `space.switch: ${longTitle}` });
    expect(trigger).toHaveAttribute("title", longTitle);
    expect(within(trigger).getByText(longTitle)).toHaveClass("truncate");
    fireEvent.click(trigger);

    const row = await screen.findByRole("menuitemradio", { name: longTitle });
    expect(row).toHaveAttribute("title", longTitle);
    expect(within(row).getByText(longTitle)).toHaveClass("max-w-full", "truncate");
  });

  it("uses the compact lockup in header chrome", () => {
    spaceState.selectedSpaceName = "spaces/product";
    spaceState.selectedSpace = spaceState.spaces[0];
    render(<SpaceSwitcher size="header" />);

    const trigger = screen.getByRole("button", { name: "space.switch: Product" });
    const title = within(trigger).getByText("Product");
    const mark = trigger.querySelector(".lucide-astroid")?.parentElement;

    expect(trigger).toHaveClass("h-9", "gap-2", "px-2");
    expect(trigger).not.toHaveClass("px-1");
    expect(title).toHaveClass("text-[15px]", "font-semibold", "leading-5");
    expect(mark).toHaveClass("size-6", "rounded-[6px]");
    expect(mark?.querySelector(".lucide-astroid")).toHaveClass("size-3.5");
    expect(trigger.querySelector(".lucide-chevrons-up-down")).toHaveClass("size-3");
    expect(trigger.querySelector(".lucide-chevron-down")).toBeNull();
  });

  it("keeps duplicate identity in the header label but out of its geometry", () => {
    spaceState.spaces = [
      { name: "spaces/product-notes", title: "Product", description: "" },
      { name: "spaces/product-archive", title: "Product", description: "" },
    ];
    spaceState.selectedSpaceName = spaceState.spaces[0].name;
    spaceState.selectedSpace = spaceState.spaces[0];
    render(<SpaceSwitcher size="header" />);

    const trigger = screen.getByRole("button", { name: "space.switch: Product (product-notes)" });
    expect(trigger).toHaveAttribute("title", "Product (product-notes)");
    expect(trigger).toHaveClass("h-9", "px-2");
    expect(within(trigger).queryByTitle("product-notes")).not.toBeInTheDocument();
  });

  it("shows UIDs only for Spaces whose titles match", async () => {
    const uuid = "123e4567-e89b-12d3-a456-426614174000";
    spaceState.spaces = [
      { name: "spaces/product-notes", title: "Product", description: "" },
      { name: `spaces/${uuid}`, title: "Product", description: "" },
      { name: "spaces/research-space", title: "Research", description: "" },
    ];
    spaceState.selectedSpaceName = spaceState.spaces[0].name;
    spaceState.selectedSpace = spaceState.spaces[0];
    render(<SpaceSwitcher />);

    const trigger = screen.getByRole("button", { name: "space.switch: Product (product-notes)" });
    expect(within(trigger).getByTitle("product-notes")).toHaveTextContent("product-notes");
    fireEvent.click(trigger);

    const customIdRow = await screen.findByRole("menuitemradio", { name: "Product (product-notes)" });
    const uuidRow = screen.getByRole("menuitemradio", { name: `Product (${uuid})` });
    expect(within(customIdRow).getByTitle("product-notes")).toHaveTextContent("product-notes");
    expect(within(uuidRow).getByTitle(uuid)).toHaveTextContent("123e4567…");
    const researchRow = screen.getByRole("menuitemradio", { name: "Research" });
    expect(within(researchRow).queryByTitle("research-space")).not.toBeInTheDocument();
    expect(researchRow).not.toHaveTextContent("research-space");
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
    fireEvent.click(screen.getByRole("button", { name: "Complete create" }));
    expect(spaceState.selectSpace).toHaveBeenCalledWith(spaceState.spaces[0]);
  });
});
