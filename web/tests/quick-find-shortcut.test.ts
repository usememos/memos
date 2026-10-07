import { describe, expect, it } from "vitest";
import { isQuickFindShortcut } from "@/utils/keyboard";

const press = (init: KeyboardEventInit, target: EventTarget = document.body): KeyboardEvent => {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
  let captured: KeyboardEvent | undefined;
  const listener = (e: Event) => {
    captured = e as KeyboardEvent;
  };
  document.addEventListener("keydown", listener);
  target.dispatchEvent(event);
  document.removeEventListener("keydown", listener);
  return captured ?? event;
};

const mount = (html: string): HTMLElement => {
  document.body.innerHTML = html;
  return document.body.querySelector("[data-target]") as HTMLElement;
};

describe("isQuickFindShortcut", () => {
  it("opens on Cmd+K and Ctrl+K, even while typing", () => {
    const input = mount(`<input data-target />`);
    expect(isQuickFindShortcut(press({ key: "k", metaKey: true }))).toBe(true);
    expect(isQuickFindShortcut(press({ key: "K", ctrlKey: true }, input))).toBe(true);
  });

  it("ignores K without a modifier or with extra modifiers", () => {
    expect(isQuickFindShortcut(press({ key: "k" }))).toBe(false);
    expect(isQuickFindShortcut(press({ key: "k", ctrlKey: true, shiftKey: true }))).toBe(false);
    expect(isQuickFindShortcut(press({ key: "k", metaKey: true, altKey: true }))).toBe(false);
  });

  it("opens on a bare slash outside text input only", () => {
    expect(isQuickFindShortcut(press({ key: "/" }))).toBe(true);
    for (const html of [
      `<input data-target />`,
      `<textarea data-target></textarea>`,
      `<div contenteditable="true"><span data-target></span></div>`,
    ]) {
      expect(isQuickFindShortcut(press({ key: "/" }, mount(html)))).toBe(false);
    }
  });

  it("ignores events already handled, repeated, or composing", () => {
    const handled = new KeyboardEvent("keydown", { key: "k", metaKey: true, cancelable: true });
    handled.preventDefault();
    expect(isQuickFindShortcut(handled)).toBe(false);
    expect(isQuickFindShortcut(press({ key: "k", metaKey: true, repeat: true }))).toBe(false);
    expect(isQuickFindShortcut(press({ key: "/", isComposing: true }))).toBe(false);
  });
});
