import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MemosLogo from "@/components/MemosLogo";
import { MemosMark } from "@/components/MemosMark";
import standardSource from "../public/logo.svg?raw";
import smallSource from "../public/logo-small.svg?raw";

const mockInstance = {
  generalSetting: {} as { customProfile?: { title?: string; logoUrl?: string } },
};

vi.mock("@/contexts/InstanceContext", () => ({
  useInstance: () => mockInstance,
}));

describe("<MemosLogo>", () => {
  beforeEach(() => {
    mockInstance.generalSetting = {};
  });

  it.each([undefined, "", "/logo.webp", "/logo.svg"])("uses the inline logo for the built-in URL %s", (logoUrl) => {
    mockInstance.generalSetting = { customProfile: { logoUrl } };
    const { container } = render(<MemosLogo />);

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).toHaveAttribute("fill", "currentColor");
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("Memos")).toBeInTheDocument();
  });

  it.each(["/custom-logo.png", "/custom-logo.svg", "https://example.com/logo.webp"])("preserves custom branding at %s", (logoUrl) => {
    mockInstance.generalSetting = { customProfile: { title: "Team Notes", logoUrl } };
    const { container } = render(<MemosLogo />);

    expect(container.querySelector("img")).toHaveAttribute("src", logoUrl);
    expect(container.querySelector(".memos-mark")).toBeNull();
    expect(screen.getByText("Team Notes")).toBeInTheDocument();
  });

  it("names the standalone mark when the title is collapsed", () => {
    render(<MemosLogo collapsed />);

    expect(screen.getByRole("img", { name: "Memos" })).toBeInTheDocument();
  });

  it("names a custom standalone logo when the title is collapsed", () => {
    mockInstance.generalSetting = { customProfile: { title: "Team Notes", logoUrl: "/custom-logo.svg" } };
    render(<MemosLogo collapsed />);

    expect(screen.getByRole("img", { name: "Team Notes" })).toHaveAttribute("src", "/custom-logo.svg");
  });
});

describe("<MemosMark>", () => {
  // Keep the inline paths aligned with the vendored upstream SVGs.
  it.each([20, 24, 28, 32, 33, 48, 64])("uses the official contour at %ipx", (size) => {
    const source = new DOMParser().parseFromString(size <= 32 ? smallSource : standardSource, "image/svg+xml");
    const { container } = render(<MemosMark size={size} />);

    expect(container.querySelector("svg")).toHaveAttribute("width", String(size));
    expect(container.querySelector("svg")).toHaveAttribute("height", String(size));
    expect(container.querySelector("g")).toHaveAttribute("transform", source.querySelector("g")?.getAttribute("transform"));
    expect(container.querySelector("path")).toHaveAttribute("d", source.querySelector("path")?.getAttribute("d"));
    expect(container.querySelector("path")).toHaveAttribute("fill-rule", "evenodd");
  });
});
