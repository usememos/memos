import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LocationDisplayView from "@/components/MemoMetadata/Location/LocationDisplayView";
import type { Location } from "@/types/proto/api/v1/memo_service_pb";

vi.mock("@/components/map/LazyLocationPicker", () => ({
  LazyLocationPicker: () => <div data-testid="location-picker" />,
}));

describe("LocationDisplayView", () => {
  it("shows the place name first and reveals coordinates only with the map", async () => {
    render(<LocationDisplayView location={{ latitude: 35.005, longitude: 135.768, placeholder: "Kyoto coffee" } as Location} />);
    const trigger = screen.getByRole("button", { name: "Kyoto coffee" });
    expect(trigger).toHaveTextContent(/^Kyoto coffee$/);
    expect(screen.queryByTestId("location-picker")).not.toBeInTheDocument();
    expect(screen.queryByText(/35\.005/)).not.toBeInTheDocument();

    fireEvent.click(trigger);
    expect(await screen.findByTestId("location-picker")).toBeVisible();
    expect(screen.getByText("35.005000°, 135.768000°")).toBeVisible();
  });

  it.each(["", "   "])("uses one coordinate label for an unnamed location, including zero", (placeholder) => {
    render(<LocationDisplayView location={{ latitude: 0, longitude: 0, placeholder } as Location} />);
    expect(screen.getByRole("button", { name: "0.0000°, 0.0000°" })).toHaveTextContent(/^0.0000°, 0.0000°$/);
  });

  it("renders nothing without a location", () => {
    const { container } = render(<LocationDisplayView />);
    expect(container).toBeEmptyDOMElement();
  });

  it("truncates the visible address while preserving the full value as a title", () => {
    const placeholder = "A very long street address that should not force the memo metadata row wider than its container";
    const location = { latitude: 1.3521, longitude: 103.8198, placeholder } as Location;

    render(<LocationDisplayView location={location} />);

    const trigger = screen.getByRole("button", { name: new RegExp(placeholder) });
    const visibleAddress = screen.getByText(placeholder);
    expect(trigger).toHaveAttribute("title", placeholder);
    expect(trigger).toHaveClass("max-w-full", "min-w-0");
    expect(visibleAddress).toHaveClass("min-w-0", "truncate");
  });
});
