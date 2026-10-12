import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import UserAvatar from "@/components/UserAvatar";

describe("UserAvatar", () => {
  it("uses the display title for a stable color behind the decorative silhouette", () => {
    const { container, rerender } = render(<UserAvatar name="Steven" />);
    const avatar = container.firstElementChild as HTMLElement;
    expect(avatar.style.getPropertyValue("--avatar-hue")).toMatch(/^\d+deg$/);
    expect(avatar).toHaveAttribute("aria-hidden", "true");
    expect(avatar.querySelector("svg")).toHaveAttribute("fill", "currentColor");
    const hue = avatar.style.getPropertyValue("--avatar-hue");

    rerender(<UserAvatar name="steven" />);
    expect(avatar.style.getPropertyValue("--avatar-hue")).toBe(hue);
    rerender(<UserAvatar name="Alice" />);
    expect(avatar.style.getPropertyValue("--avatar-hue")).not.toBe(hue);
    expect(avatar.querySelector("svg")).toBeInTheDocument();
  });

  it("keeps a supplied image and uses a neutral fallback without a title", () => {
    const { container, rerender } = render(<UserAvatar avatarUrl="/avatar.png" name="Steven" />);
    expect(container.querySelector("img")).toHaveAttribute("src", "/avatar.png");
    expect(container.querySelector("svg")).toBeNull();
    expect(container.firstElementChild).not.toHaveAttribute("style");

    rerender(<UserAvatar />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass("bg-muted");
  });
});
