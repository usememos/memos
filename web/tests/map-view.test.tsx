import { create } from "@bufbuild/protobuf";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MapView } from "@/components/MapView/MapView";
import type { MemoEditorProps } from "@/components/MemoEditor/types";
import { MemoSchema } from "@/types/proto/api/v1/memo_service_pb";

const mocks = vi.hoisted(() => ({ editor: {} as MemoEditorProps, refetch: vi.fn(), toast: vi.fn() }));
const item = create(MemoSchema, { name: "memos/one", location: { placeholder: "Kyoto", latitude: 35, longitude: 135 } });
vi.mock("@/components/MapView/MapCanvas", () => ({ MapCanvas: () => <div data-testid="map" />, fitMemos: vi.fn() }));
vi.mock("@/components/MapView/MapPanel", () => ({
  MapPanel: ({ open, busy, children }: { open: boolean; busy: boolean; children: ReactNode }) =>
    open ? (
      <div data-testid="panel" data-busy={busy}>
        {children}
      </div>
    ) : null,
}));
vi.mock("@/components/MapView/useMapMemos", () => ({
  useMapMemos: () => ({ memos: [item], complete: true, refetch: mocks.refetch }),
}));
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
vi.mock("@/contexts/MemoFilterContext", () => ({ useMemoFilterContext: () => ({ filters: [], removeFilter: vi.fn() }) }));
vi.mock("@/contexts/ViewContext", () => ({ useView: () => ({ timeBasis: "create_time", compactMode: false }) }));
vi.mock("@/hooks/useCurrentUser", () => ({ default: () => ({ name: "users/qa" }) }));
vi.mock("@/hooks/useMediaQuery", () => ({ default: () => true }));
vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));
vi.mock("react-hot-toast", () => ({ toast: mocks.toast }));

beforeEach(() => {
  sessionStorage.clear();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => vi.unstubAllGlobals());

function start() {
  render(
    <MemoryRouter initialEntries={["/spaces/travel/map?lat=35&lng=135&zoom=12&memo=memos%2Fone"]}>
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
