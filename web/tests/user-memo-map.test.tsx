import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UserMemoMap from "@/components/UserMemoMap/UserMemoMap";

const mocks = vi.hoisted(() => ({
  bounds: {},
  fitBounds: vi.fn(),
  latLngBounds: vi.fn(),
  useInfiniteMemos: vi.fn(),
}));

vi.mock("leaflet", () => ({
  default: {
    latLngBounds: mocks.latLngBounds,
    point: vi.fn(),
  },
  DivIcon: class {
    constructor(_options: unknown) {}
  },
}));

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children, attributionControl }: { children: ReactNode; attributionControl?: boolean }) => (
    <div data-testid="map" data-attribution-control={attributionControl}>
      {children}
    </div>
  ),
  Marker: ({ children, title }: { children: ReactNode; title?: string }) => (
    <div data-testid="memo-marker" data-title={title}>
      {children}
    </div>
  ),
  Popup: ({ children }: { children: ReactNode }) => children,
  useMap: () => ({ fitBounds: mocks.fitBounds }),
}));

vi.mock("react-leaflet-cluster", () => ({
  default: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/components/map/map-utils", () => ({
  defaultMarkerIcon: {},
  MinimalAttributionControl: () => <div data-testid="attribution" />,
  OpenStreetMapTileLayer: () => <div data-testid="map-layer" />,
}));

vi.mock("@/components/MemoView/components/MemoSpaceBadge", () => ({
  default: () => null,
}));

vi.mock("@/hooks/useMemoQueries", () => ({
  useInfiniteMemos: mocks.useInfiniteMemos,
}));

describe("UserMemoMap", () => {
  beforeEach(() => {
    mocks.fitBounds.mockReset();
    mocks.latLngBounds.mockReset();
    mocks.latLngBounds.mockReturnValue(mocks.bounds);
    mocks.useInfiniteMemos.mockReturnValue({ data: { pages: [] }, isLoading: false });
  });

  it("uses the explicit minimal attribution control", () => {
    render(
      <MemoryRouter>
        <UserMemoMap creator="users/1" />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("map")).toHaveAttribute("data-attribution-control", "false");
    expect(screen.getByTestId("attribution")).toBeInTheDocument();
    expect(screen.getByTestId("map-layer")).toBeInTheDocument();
  });

  it("caps automatic zoom and gives memo markers an accessible name", () => {
    mocks.useInfiniteMemos.mockReturnValue({
      data: {
        pages: [
          {
            memos: [
              {
                name: "memos/1",
                snippet: "Lunch spot",
                location: { latitude: 1, longitude: 2 },
              },
            ],
          },
        ],
      },
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <UserMemoMap creator="users/1" />
      </MemoryRouter>,
    );

    expect(mocks.latLngBounds).toHaveBeenCalledWith([[1, 2]]);
    expect(mocks.fitBounds).toHaveBeenCalledWith(mocks.bounds, { padding: [50, 50], maxZoom: 15 });
    expect(screen.getByTestId("memo-marker")).toHaveAttribute("data-title", "Lunch spot");
  });
});
