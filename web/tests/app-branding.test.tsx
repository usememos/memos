import { act, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";

const instance = vi.hoisted(() => ({
  profile: {},
  generalSetting: { customProfile: undefined as { title: string; logoUrl: string } | undefined },
}));

vi.mock("@/contexts/InstanceContext", () => ({ useInstance: () => instance }));
vi.mock("@/contexts/ViewContext", () => ({ TimelineViewProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/hooks/useNavigateTo", () => ({ default: () => vi.fn() }));
vi.mock("@/hooks/useUserLocale", () => ({ useUserLocale: () => "ltr" }));
vi.mock("@/hooks/useUserTheme", () => ({ useUserTheme: vi.fn() }));
vi.mock("@/utils/oauth", () => ({ cleanupExpiredOAuthState: vi.fn() }));
vi.mock("react-router-dom", () => ({ Outlet: () => null, ScrollRestoration: () => null }));

describe("instance favicon", () => {
  let icon: HTMLLinkElement;
  let colorScheme: MediaQueryList;

  beforeEach(() => {
    instance.generalSetting.customProfile = undefined;
    colorScheme = Object.assign(new EventTarget(), {
      matches: false,
      media: "(prefers-color-scheme: dark)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
    });
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => colorScheme),
    );
    icon = document.createElement("link");
    icon.rel = "icon";
    icon.type = "image/svg+xml";
    document.head.appendChild(icon);
  });

  afterEach(() => {
    icon.remove();
    vi.unstubAllGlobals();
  });

  it.each(["", "/logo.webp", "/logo.svg"])("uses the SVG favicon for built-in logo %s", (logoUrl) => {
    instance.generalSetting.customProfile = { title: "Memos", logoUrl };
    render(<App />);

    expect(icon).toHaveAttribute("href", "/favicon.svg?v=bird-blue");
    expect(icon).toHaveAttribute("type", "image/svg+xml");
  });

  it("preserves custom image formats and restores the default when branding is cleared", () => {
    instance.generalSetting.customProfile = { title: "Team Notes", logoUrl: "/custom.png" };
    const { rerender } = render(<App />);

    expect(document.title).toBe("Team Notes");
    expect(icon).toHaveAttribute("href", "/custom.png");
    expect(icon).not.toHaveAttribute("type");

    act(() => {
      Object.assign(colorScheme, { matches: true });
      colorScheme.dispatchEvent(new Event("change"));
    });
    expect(icon).toHaveAttribute("href", "/custom.png");

    instance.generalSetting.customProfile = undefined;
    rerender(<App />);

    expect(document.title).toBe("Memos");
    expect(icon).toHaveAttribute("href", "/favicon.svg?v=bird-blue");
    expect(icon).toHaveAttribute("type", "image/svg+xml");
  });

  it("keeps the same favicon across system color schemes", () => {
    Object.assign(colorScheme, { matches: true });
    render(<App />);
    expect(icon).toHaveAttribute("href", "/favicon.svg?v=bird-blue");

    act(() => {
      Object.assign(colorScheme, { matches: false });
      colorScheme.dispatchEvent(new Event("change"));
    });
    expect(icon).toHaveAttribute("href", "/favicon.svg?v=bird-blue");

    act(() => {
      Object.assign(colorScheme, { matches: true });
      colorScheme.dispatchEvent(new Event("change"));
    });
    expect(icon).toHaveAttribute("href", "/favicon.svg?v=bird-blue");
  });
});
