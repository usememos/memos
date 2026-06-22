import { ReactRenderer } from "@tiptap/react";
import type { SuggestionKeyDownProps, SuggestionOptions, SuggestionProps } from "@tiptap/suggestion";
import {
  type ForwardRefExoticComponent,
  forwardRef,
  type PropsWithoutRef,
  type ReactElement,
  type ReactNode,
  type RefAttributes,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface SuggestionMenuHandle {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

interface SuggestionMenuProps<T> {
  items: T[];
  command: (item: T) => void;
  renderItem: (item: T, isSelected: boolean) => ReactNode;
  getItemKey: (item: T) => string;
}

// Floating popup chrome shared by every suggestion trigger (tags today, more later).
const MENU_STYLES = {
  container:
    "z-50 p-1 max-w-48 max-h-60 rounded border bg-popover text-popover-foreground shadow-lg font-mono flex flex-col overflow-y-auto overflow-x-hidden",
  item: "rounded p-1 px-2 w-full text-sm cursor-pointer transition-colors select-none hover:bg-accent hover:text-accent-foreground",
};

function SuggestionMenuInner<T>(
  { items, command, renderItem, getItemKey }: SuggestionMenuProps<T>,
  ref: React.ForwardedRef<SuggestionMenuHandle>,
) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Keep a ref so the imperative onKeyDown handler always reads the latest
  // selected index even between React batched renders (e.g. Arrow then Enter
  // in the same synchronous tick in tests).
  const selectedIndexRef = useRef(selectedIndex);
  selectedIndexRef.current = selectedIndex;

  // Ref assigned to the currently-highlighted item so we can scroll it into
  // view when arrow navigation moves the highlight off-screen.
  const selectedItemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedIndex(0);
    selectedIndexRef.current = 0;
  }, [items]);

  // Scroll the highlighted item into view whenever it changes.
  useEffect(() => {
    selectedItemRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [selectedIndex]);

  useImperativeHandle(
    ref,
    () => ({
      onKeyDown: ({ event }) => {
        if (items.length === 0) {
          return false;
        }
        if (event.key === "ArrowDown") {
          const next = (selectedIndexRef.current + 1) % items.length;
          selectedIndexRef.current = next;
          setSelectedIndex(next);
          return true;
        }
        if (event.key === "ArrowUp") {
          const prev = (selectedIndexRef.current - 1 + items.length) % items.length;
          selectedIndexRef.current = prev;
          setSelectedIndex(prev);
          return true;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          command(items[selectedIndexRef.current]);
          return true;
        }
        return false;
      },
    }),
    [items, command],
  );

  if (items.length === 0) {
    return null;
  }

  return (
    <div data-suggestion-menu className={MENU_STYLES.container}>
      {items.map((item, index) => (
        <div
          key={getItemKey(item)}
          ref={index === selectedIndex ? selectedItemRef : undefined}
          onMouseDown={(event) => {
            event.preventDefault();
            command(item);
          }}
          className={cn(MENU_STYLES.item, index === selectedIndex && "bg-accent text-accent-foreground")}
        >
          {renderItem(item, index === selectedIndex)}
        </div>
      ))}
    </div>
  );
}

export const SuggestionMenu = forwardRef(SuggestionMenuInner) as <T>(
  props: SuggestionMenuProps<T> & { ref?: React.ForwardedRef<SuggestionMenuHandle> },
) => ReactElement | null;

/**
 * Builds the Suggestion-plugin `render` lifecycle: mounts SuggestionMenu in a
 * floating container positioned at the trigger's caret rect. No tippy —
 * a plain absolutely-positioned element on document.body.
 */
export function createSuggestionRenderer<T>(menu: {
  renderItem: (item: T, isSelected: boolean) => ReactNode;
  getItemKey: (item: T) => string;
}): SuggestionOptions<T>["render"] {
  return () => {
    let renderer: ReactRenderer<SuggestionMenuHandle> | null = null;
    let container: HTMLDivElement | null = null;
    // Unsubscribes the editor blur listener; null once run (idempotent destroy).
    let removeBlurListener: (() => void) | null = null;

    const reposition = (props: SuggestionProps<T>) => {
      const rect = props.clientRect?.();
      if (!rect || !container) {
        return;
      }
      container.style.left = `${rect.left + window.scrollX}px`;
      container.style.top = `${rect.bottom + window.scrollY + 4}px`;
    };

    const destroy = () => {
      removeBlurListener?.();
      removeBlurListener = null;
      renderer?.destroy();
      container?.remove();
      renderer = null;
      container = null;
    };

    const menuProps = (props: SuggestionProps<T>) => ({
      items: props.items,
      command: props.command,
      renderItem: menu.renderItem,
      getItemKey: menu.getItemKey,
    });

    return {
      onStart: (props) => {
        // SuggestionMenu is a generic forwardRef component; the ReactRenderer
        // constructor expects a concrete ComponentType<R, P>. We cast via
        // top-level type imports for readability (runtime shape is correct).
        type MenuProps = ReturnType<typeof menuProps>;
        renderer = new ReactRenderer<SuggestionMenuHandle, MenuProps>(
          SuggestionMenu as unknown as ForwardRefExoticComponent<PropsWithoutRef<MenuProps> & RefAttributes<SuggestionMenuHandle>>,
          {
            props: menuProps(props),
            editor: props.editor,
          },
        );
        container = document.createElement("div");
        container.style.position = "absolute";
        container.style.zIndex = "50";
        container.appendChild(renderer.element);
        document.body.appendChild(container);
        reposition(props);
        // Hide the popup when the editor loses focus so it doesn't linger.
        const handleBlur = () => destroy();
        props.editor.on("blur", handleBlur);
        removeBlurListener = () => props.editor.off("blur", handleBlur);
      },
      onUpdate: (props) => {
        renderer?.updateProps(menuProps(props));
        reposition(props);
      },
      onKeyDown: (props) => {
        if (props.event.key === "Escape") {
          destroy();
          return true;
        }
        return renderer?.ref?.onKeyDown(props) ?? false;
      },
      onExit: destroy,
    };
  };
}
