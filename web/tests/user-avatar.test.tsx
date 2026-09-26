import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import UserAvatar from "@/components/UserAvatar";

describe("UserAvatar", () => {
  it("uses the display title for a stable solid color", () => {
    const { container, rerender } = render(<UserAvatar name="Steven" />);
    const avatar = container.firstElementChild as HTMLElement;
    expect(avatar.style.getPropertyValue("--avatar-hue")).toMatch(/^\d+deg$/);
    expect(avatar.children).toHaveLength(0);
    const hue = avatar.style.getPropertyValue("--avatar-hue");

    rerender(<UserAvatar name="steven" />);
    expect(avatar.style.getPropertyValue("--avatar-hue")).toBe(hue);
    rerender(<UserAvatar name="Alice" />);
    expect(avatar.style.getPropertyValue("--avatar-hue")).not.toBe(hue);
    expect(avatar.children).toHaveLength(0);
  });

  it("keeps a supplied image and uses a neutral fallback without a title", () => {
    const { container, rerender } = render(<UserAvatar avatarUrl="/avatar.png" name="Steven" />);
    expect(container.querySelector("img")).toHaveAttribute("src", "/avatar.png");
    expect(container.firstElementChild).not.toHaveAttribute("style");

    rerender(<UserAvatar />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.firstElementChild?.children).toHaveLength(0);
    expect(container.firstElementChild).toHaveClass("bg-muted");
  });
});
