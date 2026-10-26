import { create } from "@bufbuild/protobuf";
import { render } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MapCanvas } from "@/components/MapView/MapCanvas";
import { MemoSchema } from "@/types/proto/api/memo_service_pb";

const markers = vi.hoisted(() => [] as { icon: { options: { html?: string } }; title: string; alt: string }[]);
const map = vi.hoisted(() => ({
  getContainer: vi.fn(),
  invalidateSize: vi.fn(),
  getCenter: () => ({ wrap: () => ({ lat: 35, lng: 135 }) }),
  getZoom: () => 12,
  getSize: () => ({ x: 1000, y: 800 }),
  latLngToContainerPoint: () => ({ x: 800, y: 400 }),
  setView: vi.fn(),
  fitBounds: vi.fn(),
  panBy: vi.fn(),
}));
vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: ReactNode }) => children,
  Marker: (props: { icon: { options: { html?: string } }; title: string; alt: string }) => {
    markers.push(props);
    return null;
  },
  useMap: () => map,
  useMapEvents: () => map,
}));
vi.mock("react-leaflet-cluster", () => ({ default: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/components/map/map-utils", () => ({
  createMarkerIcon: () => ({ options: {} }),
  MinimalAttributionControl: () => null,
}));

vi.mock("@/components/map/BasemapLayer", () => ({ BasemapLayer: () => null }));

beforeEach(() => {
  markers.length = 0;
  map.getContainer.mockReturnValue(document.createElement("div"));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

const memo = create(MemoSchema, { name: "memos/selected", location: { latitude: 35, longitude: 135 } });
function props(): ComponentProps<typeof MapCanvas> {
  return {
    memos: [],
    pins: new Map(),
    selected: [],
    complete: false,
    desktop: true,
    panelSize: { width: 0, height: 0 },
    onSelect: vi.fn(),
    onDismiss: vi.fn(),
    onMove: vi.fn(),
    onReady: vi.fn(),
    onTileError: vi.fn(),
  };
}

describe("map viewport", () => {
  it("reveals a deep-linked marker when its page arrives without changing zoom", () => {
    const initial = {
      ...props(),
      viewport: { lat: 35, lng: 135, zoom: 12 },
      selected: [memo.name],
      panelSize: { width: 400, height: 776 },
    };
    const { rerender } = render(<MapCanvas {...initial} />);
    expect(map.panBy).not.toHaveBeenCalled();
    rerender(<MapCanvas {...initial} memos={[memo]} complete />);
    expect(map.panBy).toHaveBeenCalledWith([240, 0], { animate: false });
    expect(map.fitBounds).not.toHaveBeenCalled();
    expect(map.setView).not.toHaveBeenCalled();
  });
  it("fits once after complete loading and never refits on a later refresh or panel change", () => {
    const initial = props();
    const { rerender } = render(<MapCanvas {...initial} memos={[memo]} />);
    expect(map.fitBounds).not.toHaveBeenCalled();
    rerender(<MapCanvas {...initial} memos={[memo]} complete />);
    expect(map.fitBounds).toHaveBeenCalledOnce();
    rerender(
      <MapCanvas {...initial} memos={[memo, { ...memo, name: "memos/another" }]} complete panelSize={{ width: 400, height: 776 }} />,
    );
    expect(map.fitBounds).toHaveBeenCalledOnce();
  });
});

describe("map pins", () => {
  const place = (name: string) => create(MemoSchema, { name, location: { placeholder: "Kyoto", latitude: 35, longitude: 135 } });
  const lastMarker = (name: string) => markers.filter((marker) => marker.alt.startsWith(name)).at(-1)!;

  it("draws the calendar's marks at map scale: photo square, author avatar, or the plain dot", () => {
    const pins = new Map([
      ["memos/photo", { face: { kind: "photo" as const, url: "/thumb.jpg" }, label: "photo" }],
      ["memos/author", { face: { kind: "author" as const, avatarUrl: "/bob.png", name: "Bob" }, label: "author" }],
      ["memos/dot", { face: { kind: "dot" as const }, label: "dot" }],
    ]);
    render(<MapCanvas {...props()} memos={[place("memos/photo"), place("memos/author"), place("memos/dot")]} pins={pins} />);
    expect(lastMarker("photo").icon.options.html).toContain("url(&quot;/thumb.jpg&quot;)");
    expect(lastMarker("author").icon.options.html).toContain('src="/bob.png"');
    expect(lastMarker("dot").icon.options.html).toBeUndefined();
  });

  it("labels a pin with its place and author, and falls back to the place alone", () => {
    const pins = new Map([["memos/a", { face: { kind: "dot" as const }, label: "Kyoto · Bob" }]]);
    render(<MapCanvas {...props()} memos={[place("memos/a"), place("memos/b")]} pins={pins} />);
    expect(markers.find((marker) => marker.title === "Kyoto · Bob")?.alt).toBe("Kyoto · Bob");
    expect(markers.some((marker) => marker.title === "Kyoto")).toBe(true);
  });

  it("grows a selected face pin and reuses one icon per face", () => {
    const face = { kind: "author" as const, avatarUrl: "/bob.png", name: "Bob" };
    const pins = new Map([
      ["memos/a", { face, label: "a" }],
      ["memos/b", { face, label: "b" }],
    ]);
    const { rerender } = render(<MapCanvas {...props()} memos={[place("memos/a"), place("memos/b")]} pins={pins} />);
    expect(lastMarker("a").icon).toBe(lastMarker("b").icon);
    rerender(<MapCanvas {...props()} memos={[place("memos/a"), place("memos/b")]} pins={pins} selected={["memos/a"]} />);
    expect(lastMarker("a").icon).not.toBe(lastMarker("b").icon);
    expect(lastMarker("a").icon.options.html).toContain("bg-primary/20");
  });

  it("writes a label that resolves after the first draw onto the live marker", () => {
    const element = document.createElement("div");
    const live = { options: { title: "Kyoto" }, getElement: () => element };
    const attach = (marker: { ref?: (value: unknown) => void }) => marker.ref?.(live);
    const memos = [place("memos/a")];
    const { rerender } = render(<MapCanvas {...props()} memos={memos} />);
    attach(markers.at(-1) as never);
    rerender(
      <MapCanvas {...props()} memos={memos} pins={new Map([["memos/a", { face: { kind: "dot" as const }, label: "Kyoto · Bob" }]])} />,
    );
    expect(live.options.title).toBe("Kyoto · Bob");
    expect(element).toHaveAttribute("title", "Kyoto · Bob");
  });
});
