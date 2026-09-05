import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { HashIcon } from "lucide-react";
import { useEffect } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import SidebarRow, { sidebarRowStateClasses } from "@/components/AppSidebar/SidebarRow";
import { SIDEBAR_SECTION_ACTION_ACTIVE_CLASSES } from "@/components/AppSidebar/SidebarSection";
import TagsSection from "@/components/AppSidebar/TagsSection";
import MemoFilters from "@/components/MemoFilters";
import { AppSidebarProvider } from "@/contexts/AppSidebarContext";
import { MemoFilterProvider, useMemoFilterContext } from "@/contexts/MemoFilterContext";
import { BUILTIN_TASKS_VIEW_ID } from "@/lib/memo-views";

vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));
vi.mock("@/hooks/useCurrentUser", () => ({ default: () => ({ name: "users/1" }) }));
vi.mock("@/hooks/useUserQueries", () => ({
  useMemoViews: () => ({ data: [{ name: "users/1/memoViews/abc", title: "Last week", filter: "pinned" }] }),
}));

const tokens = (classes: string) => classes.split(" ");

/**
 * The rail has two selected meanings and each gets its own look: a filled row is the page
 * you are on, a checked row is a filter that is on. Views, tags and days are filters, so
 * they must never wear the fill, and every filter that is on must be echoed above the list.
 */
describe("sidebar selected grammar", () => {
  it("fills only a current row", () => {
    expect(tokens(sidebarRowStateClasses("current"))).toContain("bg-sidebar-accent");
    expect(tokens(sidebarRowStateClasses("checked"))).not.toContain("bg-sidebar-accent");
    expect(tokens(sidebarRowStateClasses("checked"))).toContain("before:bg-primary");
    expect(tokens(sidebarRowStateClasses())).not.toContain("font-medium");
  });

  it("marks a checked row so its icon and count take the accent", () => {
    render(<SidebarRow state="checked" icon={HashIcon} label="work" count={4} />);

    const row = screen.getByRole("button", { name: "work4" });
    expect(row).toHaveAttribute("data-checked");
    expect(row).toHaveAttribute("aria-pressed", "true");
    expect(row).not.toHaveClass("bg-sidebar-accent");
    expect(row.querySelector("svg")).toHaveClass("group-data-checked:text-primary");
    expect(screen.getByText("4")).toHaveClass("group-data-checked:text-primary");
  });

  it("checks a tag row instead of filling it", () => {
    render(
      <MemoryRouter>
        <MemoFilterProvider>
          <TagsSection tagCount={{ work: 2 }} scope="home" />
        </MemoFilterProvider>
      </MemoryRouter>,
    );

    const row = screen.getByRole("button", { name: "#work, setting.tags.used-count" });
    expect(row).not.toHaveAttribute("data-checked");
    fireEvent.click(row);
    expect(row).toHaveAttribute("data-checked");
    expect(row).not.toHaveClass("bg-sidebar-accent");
  });

  it("keeps section mode toggles surface-free", () => {
    expect(tokens(SIDEBAR_SECTION_ACTION_ACTIVE_CLASSES)).not.toContain("bg-sidebar-accent");
  });
});

const SelectView = ({ id }: { id: string }) => {
  const { setMemoView } = useMemoFilterContext();
  useEffect(() => setMemoView(id), [id, setMemoView]);
  return null;
};

const renderChips = (path: string, viewId?: string) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <AppSidebarProvider>
          <MemoFilterProvider>
            {viewId && <SelectView id={viewId} />}
            <MemoFilters />
          </MemoFilterProvider>
        </AppSidebarProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("MemoFilters", () => {
  it("echoes the active view like any other filter, and clears it from the chip", () => {
    renderChips("/", BUILTIN_TASKS_VIEW_ID);

    expect(screen.getByText("common.tasks")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove filter" }));
    expect(screen.queryByText("common.tasks")).not.toBeInTheDocument();
  });

  it("names a saved view by its title", () => {
    renderChips("/", "abc");
    expect(screen.getByText("Last week")).toBeInTheDocument();
  });

  it("announces a view on a user profile, where it narrows that user's memos", () => {
    renderChips("/u/alice", BUILTIN_TASKS_VIEW_ID);
    expect(screen.getByText("common.tasks")).toBeInTheDocument();
  });

  it("stays quiet about a view off the collection routes, where it does not apply", () => {
    renderChips("/attachments", BUILTIN_TASKS_VIEW_ID);
    expect(screen.queryByText("common.tasks")).not.toBeInTheDocument();
  });

  it("formats a day filter as a date rather than the raw value", () => {
    renderChips("/?filter=displayTime:2026-09-02");
    expect(screen.getByText("Sep 2, 2026")).toBeInTheDocument();
  });
});
