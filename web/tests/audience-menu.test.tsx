import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialState, EditorProvider, useEditorContext, useEditorSelector } from "@/components/MemoEditor/state";
import AudienceMenu from "@/components/MemoEditor/Toolbar/AudienceMenu";
import { EditorToolbar } from "@/components/MemoEditor/Toolbar/EditorToolbar";
import { Visibility } from "@/types/proto/api/memo_service_pb";

const spacesQuery = vi.hoisted(() => ({
  data: [
    { name: "spaces/work", title: "Work", icon: { value: { case: "emoji", value: "💎" } } },
    { name: "spaces/reading", title: "Reading" },
  ] as { name: string; title: string; icon?: unknown }[],
  isPending: false,
  isError: false,
  refetch: vi.fn(),
}));
vi.mock("@/components/MemoEditor/Toolbar/InsertMenu", () => ({ default: () => null }));
vi.mock("@/hooks/useCurrentUser", () => ({ default: () => ({ name: "users/test" }) }));
vi.mock("@/hooks/useSpaceQueries", () => ({ useSpaces: () => spacesQuery }));

// Echo interpolation so tests can see which Space a string names.
vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string, options?: { space?: string }) => (options?.space ? `${key}(${options.space})` : key),
}));

// Base UI menus reach for layout/pointer APIs jsdom doesn't implement.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

const openMenu = async () => {
  fireEvent.click(screen.getByRole("button"));
  await screen.findByRole("menu");
};

const openSpaces = async (name: string) => {
  fireEvent.click(screen.getByRole("menuitem", { name }));
  return screen.findAllByRole("menu");
};

const visibilityRows = () =>
  screen
    .getAllByRole("menuitem")
    .map((item) => item.textContent)
    .filter((text) => text?.startsWith("memo.visibility."));

beforeEach(() => {
  vi.clearAllMocks();
  spacesQuery.isPending = false;
  spacesQuery.isError = false;
  spacesQuery.data = [
    { name: "spaces/work", title: "Work", icon: { value: { case: "emoji", value: "💎" } } },
    { name: "spaces/reading", title: "Reading" },
  ];
});

describe("AudienceMenu visibility", () => {
  it("omits the Members audience when the memo has no Space", async () => {
    render(<AudienceMenu value={Visibility.PRIVATE} onChange={vi.fn()} />);
    await openMenu();

    expect(visibilityRows()).toEqual([
      "memo.visibility.privatememo.visibility.private-description",
      "memo.visibility.protectedmemo.visibility.protected-description",
      "memo.visibility.publicmemo.visibility.public-description",
    ]);
  });

  it("offers the Members audience, described with the Space's name, when the memo belongs to a Space", async () => {
    render(<AudienceMenu value={Visibility.PRIVATE} space="spaces/work" onChange={vi.fn()} />);
    await openMenu();

    expect(screen.getByRole("menuitem", { name: /memo\.visibility\.space/ })).toHaveTextContent("memo.visibility.space-description(Work)");
  });

  it("keeps naming the current Members audience even when placement is unavailable", async () => {
    render(<AudienceMenu value={Visibility.SPACE} onChange={vi.fn()} />);

    expect(screen.getByRole("button")).toHaveTextContent("memo.visibility.space");
    await openMenu();
    expect(screen.getByRole("menuitem", { name: /memo\.visibility\.space/ })).toBeInTheDocument();
  });

  it("reports the picked audience", async () => {
    const onChange = vi.fn();
    render(<AudienceMenu value={Visibility.PRIVATE} onChange={onChange} />);
    await openMenu();

    fireEvent.click(screen.getByRole("menuitem", { name: /memo\.visibility\.public/ }));

    expect(onChange).toHaveBeenCalledWith(Visibility.PUBLIC);
  });

  it("has no Space row when the host fixes placement", async () => {
    render(<AudienceMenu value={Visibility.PRIVATE} space="spaces/work" onChange={vi.fn()} />);
    await openMenu();

    expect(screen.queryByRole("menuitem", { name: "space.add-to" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Work" })).not.toBeInTheDocument();
    expect(screen.getByRole("button")).not.toHaveTextContent("Work");
  });
});

describe("AudienceMenu Space row", () => {
  it("adds a memo to a Space from an unnamed empty state below the audiences", async () => {
    const onSpaceChange = vi.fn();
    const onChange = vi.fn();
    render(<AudienceMenu value={Visibility.PRIVATE} onChange={onChange} onSpaceChange={onSpaceChange} />);
    expect(screen.getByRole("button")).toHaveAccessibleName("memo.visibility.private");
    await openMenu();

    const items = screen.getAllByRole("menuitem");
    expect(items[items.length - 1]).toHaveAccessibleName("space.add-to");
    await openSpaces("space.add-to");
    expect(screen.getByRole("menuitem", { name: "Reading" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Work" }));

    expect(onSpaceChange).toHaveBeenCalledWith("spaces/work");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows the chosen Space and toggles it off from the submenu", async () => {
    const onSpaceChange = vi.fn();
    render(<AudienceMenu value={Visibility.PRIVATE} space="spaces/work" onChange={vi.fn()} onSpaceChange={onSpaceChange} />);
    expect(screen.getByRole("button")).toHaveAccessibleName("Work · memo.visibility.private");
    await openMenu();

    expect(screen.queryByRole("menuitem", { name: "space.add-to" })).not.toBeInTheDocument();
    await openSpaces("Work");
    const selected = screen.getByRole("menuitem", { name: "space.remove-from(Work)" });
    expect(selected).toHaveAttribute("title", "space.remove-from(Work)");
    expect(screen.getByRole("menuitem", { name: "Reading" })).toBeInTheDocument();
    fireEvent.click(selected);

    expect(onSpaceChange).toHaveBeenCalledWith(undefined);
  });

  it("keeps a Space the user is no longer a member of removable", async () => {
    const onSpaceChange = vi.fn();
    render(<AudienceMenu value={Visibility.PRIVATE} space="spaces/gone" onChange={vi.fn()} onSpaceChange={onSpaceChange} />);
    await openMenu();

    await openSpaces("gone");
    fireEvent.click(screen.getByRole("menuitem", { name: "space.remove-from(gone)" }));

    expect(onSpaceChange).toHaveBeenCalledWith(undefined);
  });

  it("disambiguates duplicate Space titles and keeps long titles for hover and assistive text", async () => {
    const longTitle = `Work ${"a very long Space title ".repeat(15).trim()}`;
    spacesQuery.data = [
      { name: "spaces/work", title: longTitle },
      { name: "spaces/a", title: "Twin" },
      { name: "spaces/b", title: "Twin" },
    ];
    render(<AudienceMenu value={Visibility.PRIVATE} space="spaces/work" onChange={vi.fn()} onSpaceChange={vi.fn()} />);

    expect(screen.getByRole("button")).toHaveAttribute("title", `${longTitle} · memo.visibility.private`);
    await openMenu();
    await openSpaces(longTitle);
    expect(screen.getByRole("menuitem", { name: "Twin (a)" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Twin (b)" })).toBeInTheDocument();
  });

  it("hides the Space row when there is no Space to add to", async () => {
    spacesQuery.data = [];
    render(<AudienceMenu value={Visibility.PRIVATE} onChange={vi.fn()} onSpaceChange={vi.fn()} />);
    await openMenu();

    expect(screen.queryByRole("menuitem", { name: "space.add-to" })).not.toBeInTheDocument();
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
  });

  it("shows loading and retry states in the submenu without losing audiences", async () => {
    spacesQuery.data = [];
    spacesQuery.isPending = true;
    const props = { value: Visibility.PRIVATE, onChange: vi.fn(), onSpaceChange: vi.fn() };
    const { rerender } = render(<AudienceMenu {...props} />);
    await openMenu();
    await openSpaces("space.add-to");
    expect(screen.getByRole("menuitem", { name: "space.loading" })).toHaveAttribute("aria-disabled", "true");

    spacesQuery.isPending = false;
    spacesQuery.isError = true;
    rerender(<AudienceMenu {...props} />);
    fireEvent.click(screen.getByRole("menuitem", { name: /space\.load-error/ }));

    expect(spacesQuery.refetch).toHaveBeenCalled();
    expect(visibilityRows()).toHaveLength(3);
  });
});

it("removing a Members memo from its Space falls back to Private without discarding content", async () => {
  let getState: ReturnType<typeof useEditorContext>["getState"];
  function Toolbar() {
    getState = useEditorContext().getState;
    const space = useEditorSelector((state) => state.metadata.space);
    return <EditorToolbar space={space} canChooseSpace onSave={vi.fn()} onAudioRecorderClick={vi.fn()} onInsertImages={vi.fn()} />;
  }
  const initial = createInitialState();
  initial.content = "Keep this draft";
  initial.metadata = { ...initial.metadata, space: "spaces/work", visibility: Visibility.SPACE };
  render(
    <EditorProvider initialEditorState={initial}>
      <Toolbar />
    </EditorProvider>,
  );

  fireEvent.click(screen.getByRole("button", { name: "Work · memo.visibility.space" }));
  await screen.findByRole("menu");
  await openSpaces("Work");
  fireEvent.click(screen.getByRole("menuitem", { name: "space.remove-from(Work)" }));

  expect(getState!().metadata.space).toBeUndefined();
  expect(getState!().metadata.visibility).toBe(Visibility.PRIVATE);
  expect(getState!().content).toBe("Keep this draft");
});
