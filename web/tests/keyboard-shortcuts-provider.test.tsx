import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  KEYBOARD_SHORTCUTS_STORAGE_KEY,
  KeyboardShortcutsProvider,
  useKeyboardShortcutsContext,
} from "@/contexts/KeyboardShortcutsContext";
import { type ShortcutHandlers, useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

const Bindings = ({ handlers }: { handlers: ShortcutHandlers }) => {
  useKeyboardShortcuts(handlers);
  return null;
};

const HelpBinding = () => {
  const { openHelp } = useKeyboardShortcutsContext();
  useKeyboardShortcuts({ "help.open": openHelp });
  return null;
};

const Toggle = () => {
  const { enabled, setEnabled } = useKeyboardShortcutsContext();
  return (
    <button type="button" onClick={() => setEnabled(!enabled)}>
      toggle
    </button>
  );
};

const press = (key: string, target: Element | Document = document.body, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(target, { key, bubbles: true, cancelable: true, ...init });

afterEach(() => {
  window.localStorage.clear();
});

describe("KeyboardShortcutsProvider", () => {
  it("fires a sequence without also firing its last key", () => {
    const focusEditor = vi.fn();
    const goInbox = vi.fn();
    render(
      <KeyboardShortcutsProvider>
        <Bindings handlers={{ "editor.focus": focusEditor }} />
        <Bindings handlers={{ "go.inbox": goInbox }} />
      </KeyboardShortcutsProvider>,
    );

    press("g");
    press("i");
    expect(goInbox).toHaveBeenCalledTimes(1);
    expect(focusEditor).not.toHaveBeenCalled();

    press("i");
    expect(focusEditor).toHaveBeenCalledTimes(1);
  });

  it("ignores typing, open overlays, and handled events", () => {
    const newMemo = vi.fn();
    render(
      <KeyboardShortcutsProvider>
        <Bindings handlers={{ "memo.new": newMemo }} />
        <input data-testid="input" />
      </KeyboardShortcutsProvider>,
    );

    press("n", screen.getByTestId("input"));
    const handled = new KeyboardEvent("keydown", { key: "n", bubbles: true, cancelable: true });
    handled.preventDefault();
    document.body.dispatchEvent(handled);

    const overlay = document.createElement("div");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("data-open", "");
    document.body.append(overlay);
    press("n");
    overlay.remove();
    expect(newMemo).not.toHaveBeenCalled();

    press("n");
    expect(newMemo).toHaveBeenCalledTimes(1);
  });

  it.each(["shiftKey", "ctrlKey", "metaKey", "altKey"])("does not swallow i after g with %s", (modifier) => {
    const focusEditor = vi.fn();
    const goInbox = vi.fn();
    render(
      <KeyboardShortcutsProvider>
        <Bindings handlers={{ "editor.focus": focusEditor, "go.inbox": goInbox }} />
      </KeyboardShortcutsProvider>,
    );

    press("g", document.body, { [modifier]: true });
    press("i");
    expect(focusEditor).toHaveBeenCalledTimes(1);
    expect(goInbox).not.toHaveBeenCalled();
  });

  it("still fires a single key that follows g when g + key is not a sequence", () => {
    const newMemo = vi.fn();
    render(
      <KeyboardShortcutsProvider>
        <Bindings handlers={{ "memo.new": newMemo }} />
      </KeyboardShortcutsProvider>,
    );

    press("g");
    press("n");
    expect(newMemo).toHaveBeenCalledTimes(1);
  });

  it("stops dispatching when disabled and remembers the choice", () => {
    const newMemo = vi.fn();
    render(
      <KeyboardShortcutsProvider>
        <Bindings handlers={{ "memo.new": newMemo }} />
        <Toggle />
      </KeyboardShortcutsProvider>,
    );

    act(() => screen.getByText("toggle").click());
    press("n");
    expect(newMemo).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(KEYBOARD_SHORTCUTS_STORAGE_KEY)).toBe("false");
  });

  it("opens the cheat sheet with ?", async () => {
    render(
      <KeyboardShortcutsProvider>
        <HelpBinding />
      </KeyboardShortcutsProvider>,
    );

    press("?", document.body, { shiftKey: true });
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  });

  it("returns focus to the help opener on close", async () => {
    const HelpButton = () => {
      const { openHelp } = useKeyboardShortcutsContext();
      return <button onClick={openHelp}>View shortcuts</button>;
    };
    render(
      <KeyboardShortcutsProvider>
        <HelpButton />
      </KeyboardShortcutsProvider>,
    );
    const opener = screen.getByRole("button", { name: "View shortcuts" });
    act(() => opener.focus());
    fireEvent.click(opener);
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    press("Escape", document.activeElement as Element);
    await waitFor(() => expect(opener).toHaveFocus());
  });
});
