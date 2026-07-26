import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LocationDisplayView from "@/components/MemoMetadata/Location/LocationDisplayView";
import type { Location } from "@/types/proto/api/v1/memo_service_pb";

vi.mock("@/components/map/LazyLocationPicker", () => ({
  LazyLocationPicker: () => <div data-testid="location-picker" />,
}));

describe("LocationDisplayView", () => {
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
