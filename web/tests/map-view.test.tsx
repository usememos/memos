import { create } from "@bufbuild/protobuf";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MapView } from "@/components/MapView/MapView";
import type { MemoEditorProps } from "@/components/MemoEditor/types";
import { type Memo, MemoSchema } from "@/types/proto/api/memo_service_pb";

const mocks = vi.hoisted(() => ({
  editor: {} as MemoEditorProps,
  refetch: vi.fn(),
  toast: vi.fn(),
  memos: [] as Memo[],
  user: { name: "users/qa" } as { name: string } | undefined,
  filters: [] as unknown[],
}));
const item = create(MemoSchema, {
  name: "memos/one",
  creator: "users/qa",
  location: { placeholder: "Kyoto", latitude: 35, longitude: 135 },
});
vi.mock("@/components/MapView/MapCanvas", () => ({ MapCanvas: () => <div data-testid="map" />, fitMemos: vi.fn() }));
vi.mock("@/components/MemoPanel/MemoPanel", () => ({
  MEMO_PANEL_INSET: 12,
  MemoPanel: ({ open, busy, title, children }: { open: boolean; busy: boolean; title: string; children: ReactNode }) =>
    open ? (
      <div data-testid="panel" data-busy={busy} data-title={title}>
        {children}
      </div>
    ) : null,
}));
vi.mock("@/components/MapView/useMapMemos", () => ({
  useMapMemos: () => ({ memos: mocks.memos, complete: true, refetch: mocks.refetch }),
}));
vi.mock("@/components/MapView/useMapPins", () => ({ useMapPins: () => new Map() }));
vi.mock("@/components/MemoEditor", () => ({
  default: (props: MemoEditorProps) => {
    mocks.editor = props;
    return <div data-testid="editor" />;
  },
}));
vi.mock("@/components/MemoView", () => ({ default: () => <p>Memo</p> }));
vi.mock("@/components/MemoContent/MentionResolutionContext", () => ({
  MentionResolutionProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/contexts/NewMemoContext", () => ({ NewMemoProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ isUserSettingsInitialized: true }) }));
vi.mock("@/contexts/SpaceContext", () => ({ useSpaceContext: () => ({ selectedSpaceName: "spaces/travel" }) }));
vi.mock("@/contexts/MemoFilterContext", () => ({ useMemoFilterContext: () => ({ filters: mocks.filters, removeFilter: vi.fn() }) }));
vi.mock("@/contexts/ViewContext", () => ({ useView: () => ({ timeBasis: "create_time", compactMode: false }) }));
vi.mock("@/hooks/useCurrentUser", () => ({ default: () => mocks.user }));
vi.mock("@/hooks/useMediaQuery", () => ({ default: () => true }));
vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));
vi.mock("react-hot-toast", () => ({ toast: mocks.toast }));

beforeEach(() => {
  sessionStorage.clear();
  mocks.memos = [item];
  mocks.user = { name: "users/qa" };
  mocks.filters = [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => vi.unstubAllGlobals());

function start(selection = "memo=memos%2Fone") {
  render(
    <MemoryRouter initialEntries={[`/spaces/travel/map?lat=35&lng=135&zoom=12&${selection}`]}>
      <MapView />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByText("map.new-here"));
}

describe("map composer", () => {
  it("keeps map fitting available without a location-picking action", async () => {
    render(
      <MemoryRouter initialEntries={["/map"]}>
        <MapView />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "map.pick-location" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "map.fit-all" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "common.more" })).not.toBeInTheDocument();
  });
  it("seeds the selected point and Space and releases controls after save", async () => {
    mocks.refetch.mockResolvedValue({ data: { pages: [{ memos: [item] }] } });
    start();
    expect(mocks.editor.defaultSpace).toBe("spaces/travel");
    expect(mocks.editor.defaultLocation).toEqual(item.location);
    act(() => mocks.editor.onSavingChange?.(true));
    expect(screen.getByTestId("panel")).toHaveAttribute("data-busy", "true");
    act(() => mocks.editor.onConfirm?.("memos/one"));
    await waitFor(() => expect(screen.getByTestId("panel")).toHaveAttribute("data-busy", "false"));
    expect(screen.queryByTestId("editor")).not.toBeInTheDocument();
  });
  it("offers a working action when the saved memo falls outside the filter", async () => {
    mocks.refetch.mockResolvedValue({ data: { pages: [{ memos: [] }] } });
    start();
    act(() => mocks.editor.onConfirm?.("memos/outside"));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    // Toasts render outside the router; the action must not require router context.
    const toastContent = mocks.toast.mock.calls[0][0]({ id: "saved" });
    render(toastContent);
    expect(screen.getByRole("button", { name: "map.open-memo" })).toBeVisible();
  });
  it("reports refresh failure without claiming the saved memo is outside the filter", async () => {
    mocks.refetch.mockResolvedValue({ isError: true });
    start();
    act(() => mocks.editor.onConfirm?.("memos/saved"));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    render(mocks.toast.mock.calls[0][0]({ id: "saved" }));
    expect(screen.getByText("map.load-error")).toBeVisible();
    expect(screen.queryByText("map.saved-outside-filter")).not.toBeInTheDocument();
  });
});

describe("map place labels", () => {
  const other = create(MemoSchema, {
    name: "memos/two",
    creator: "users/alice",
    location: { placeholder: "Mom's house", latitude: 35, longitude: 135 },
  });

  it("never copies another author's label into a new memo", () => {
    mocks.memos = [other];
    start("memo=memos%2Ftwo");
    expect(mocks.editor.defaultLocation).toMatchObject({ latitude: 35, longitude: 135, placeholder: "35.0000°, 135.0000°" });
    // A single author's label still titles their own memos.
    expect(screen.getByTestId("panel")).toHaveAttribute("data-title", "Mom's house");
  });

  it("titles a mixed-author point by coordinates unless everyone used the same label", () => {
    mocks.memos = [other, item];
    start("memo=memos%2Ftwo&memo=memos%2Fone");
    expect(screen.getByTestId("panel")).toHaveAttribute("data-title", "35.0000°, 135.0000°");
    // The writer's own label at the point is theirs to reuse.
    expect(mocks.editor.defaultLocation).toMatchObject({ placeholder: "Kyoto" });
  });
});

describe("map empty state", () => {
  const renderEmpty = () =>
    render(
      <MemoryRouter initialEntries={["/map"]}>
        <MapView />
      </MemoryRouter>,
    );

  it("does not ask guests to add a location they cannot add", () => {
    mocks.memos = [];
    mocks.user = undefined;
    renderEmpty();
    expect(screen.getByText("map.empty")).toBeInTheDocument();
    expect(screen.queryByText("map.empty-hint")).not.toBeInTheDocument();
  });

  it("keeps the hint for signed-in users", () => {
    mocks.memos = [];
    renderEmpty();
    expect(screen.getByText("map.empty-hint")).toBeInTheDocument();
  });
});
