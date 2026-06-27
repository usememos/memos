import { act, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { createSuggestionRenderer, SuggestionMenu, type SuggestionMenuHandle } from "@/components/MemoEditor/Editor/suggestionMenu";

function setup(items = ["alpha", "beta", "gamma"]) {
  const command = vi.fn();
  const ref = createRef<SuggestionMenuHandle>();
  render(
    <SuggestionMenu
      ref={ref}
      items={items}
      command={command}
      getItemKey={(item: string) => item}
      renderItem={(item: string) => <span>#{item}</span>}
    />,
  );
  return { command, ref };
}

const keyDown = (key: string) => ({ event: new KeyboardEvent("keydown", { key }) }) as never;

describe("SuggestionMenu", () => {
  it("renders all items", () => {
    setup();
    expect(screen.getByText("#alpha")).toBeInTheDocument();
    expect(screen.getByText("#gamma")).toBeInTheDocument();
  });

  it("navigates with arrows and selects with Enter", () => {
    const { command, ref } = setup();
    expect(ref.current?.onKeyDown(keyDown("ArrowDown"))).toBe(true);
    expect(ref.current?.onKeyDown(keyDown("Enter"))).toBe(true);
    expect(command).toHaveBeenCalledWith("beta");
  });

  it("selects on mouse down", () => {
    const { command } = setup();
    fireEvent.mouseDown(screen.getByText("#gamma"));
    expect(command).toHaveBeenCalledWith("gamma");
  });

  it("renders nothing for an empty list and lets keys pass through", () => {
    const { ref } = setup([]);
    expect(document.querySelector("[data-suggestion-menu]")).toBeNull();
    expect(ref.current?.onKeyDown(keyDown("Enter"))).toBe(false);
  });

  it("scrolls the selected item into view on arrow navigation", async () => {
    const { ref } = setup(["a", "b", "c"]);
    // Assign scrollIntoView spy on HTMLElement.prototype so it survives re-renders.
    const spy = vi.fn();
    const original = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = spy;
    try {
      await act(async () => {
        ref.current?.onKeyDown(keyDown("ArrowDown"));
      });
      expect(spy).toHaveBeenCalled();
    } finally {
      HTMLElement.prototype.scrollIntoView = original;
    }
  });
});

describe("createSuggestionRenderer blur handling", () => {
  /**
   * Build a minimal fake editor that satisfies the ReactRenderer constructor:
   * - isEditorContentInitialized=true causes ReactRenderer to call flushSync,
   *   so the component renders synchronously.
   * - contentComponent.setRenderer renders the React element into renderer.element
   *   via createPortal, making [data-suggestion-menu] visible in the DOM.
   */
  function makeFakeEditor() {
    const handlers: Record<string, Array<() => void>> = {};
    const fakeEditor = {
      isEditorContentInitialized: true,
      contentComponent: {
        setRenderer: vi.fn((_id: string, renderer: { reactElement: React.ReactNode; element: HTMLElement }) => {
          // Mimic the real portal: render the element directly into renderer.element
          // via React so it shows up in the DOM when appended to document.body.
          const root = createRoot(renderer.element);
          act(() => {
            root.render(renderer.reactElement as React.ReactElement);
          });
        }),
        removeRenderer: vi.fn(),
      },
      on: vi.fn((event: string, handler: () => void) => {
        (handlers[event] ??= []).push(handler);
      }),
      off: vi.fn(),
      handlers,
    };
    return fakeEditor;
  }

  it("destroys the popup container and unsubscribes on editor blur", () => {
    const fakeEditor = makeFakeEditor();

    const renderFn = createSuggestionRenderer<string>({
      renderItem: (item: string) => <span>{item}</span>,
      getItemKey: (item: string) => item,
    });

    const lifecycle = renderFn!();

    act(() => {
      lifecycle!.onStart!({
        clientRect: () => null,
        editor: fakeEditor as never,
        items: ["x"],
        command: vi.fn(),
        query: "",
        text: "",
        decorationNode: null,
      } as never);
    });

    // The outer container div must be attached to document.body.
    const container = document.body.lastElementChild as HTMLElement;
    expect(container).not.toBeNull();
    expect(container?.style.position).toBe("absolute");
    expect(container?.isConnected).toBe(true);

    expect(fakeEditor.on).toHaveBeenCalledWith("blur", expect.any(Function));

    // Simulate the editor emitting "blur".
    const blurHandler = fakeEditor.handlers["blur"]?.[0];
    expect(blurHandler).toBeDefined();
    act(() => {
      blurHandler?.();
    });

    // Container must be detached from the document.
    expect(container.isConnected).toBe(false);
    // off must have been called to avoid leaking the listener.
    expect(fakeEditor.off).toHaveBeenCalledWith("blur", expect.any(Function));
  });

  it("is idempotent — calling destroy twice does not throw", () => {
    const fakeEditor = {
      isEditorContentInitialized: false,
      on: vi.fn(),
      off: vi.fn(),
    };

    const renderFn = createSuggestionRenderer<string>({
      renderItem: (item: string) => <span>{item}</span>,
      getItemKey: (item: string) => item,
    });

    const lifecycle = renderFn!();

    act(() => {
      lifecycle!.onStart!({
        clientRect: () => null,
        editor: fakeEditor as never,
        items: ["x"],
        command: vi.fn(),
        query: "",
        text: "",
        decorationNode: null,
      } as never);
    });

    act(() => {
      lifecycle!.onExit!({} as never);
      // Second call (e.g. from Escape after onExit) must not throw.
      lifecycle!.onExit!({} as never);
    });

    expect(fakeEditor.off).toHaveBeenCalledTimes(1);
  });
});
