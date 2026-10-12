import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useUserTheme } from "@/hooks/useUserTheme";
import { loadTheme } from "@/utils/theme";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ userGeneralSetting: undefined }),
}));

describe("guest theme preferences", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it.each(["system", "default-dark"])("respects local changes after starting with %s", (initialTheme) => {
    let dark = false;
    const changes = new EventTarget();
    vi.stubGlobal("matchMedia", () => ({
      get matches() {
        return dark;
      },
      addEventListener: changes.addEventListener.bind(changes),
      removeEventListener: changes.removeEventListener.bind(changes),
    }));
    loadTheme(initialTheme);
    renderHook(() => useUserTheme());

    loadTheme("paper");
    dark = true;
    changes.dispatchEvent(new Event("change"));
    expect(document.documentElement).toHaveAttribute("data-theme", "paper");
    expect(localStorage.getItem("memos-theme")).toBe("paper");

    loadTheme("system");
    expect(document.documentElement).toHaveAttribute("data-theme", "default-dark");
    dark = false;
    changes.dispatchEvent(new Event("change"));
    expect(document.documentElement).toHaveAttribute("data-theme", "default");
    expect(localStorage.getItem("memos-theme")).toBe("system");
  });
});
