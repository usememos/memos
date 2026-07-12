import { useEffect, useLayoutEffect, useRef } from "react";

/**
 * Manages the DOM-only parts of focus mode: body scroll locking and a measured
 * placeholder height that keeps masonry/grid layouts stable while the editor
 * itself is fixed above the page.
 */
export function useFocusMode(isFocusMode: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const normalModeHeightRef = useRef(0);

  useEffect(() => {
    if (!isFocusMode) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFocusMode]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || isFocusMode) return;

    const updateHeight = () => {
      normalModeHeightRef.current = container.getBoundingClientRect().height;
    };
    updateHeight();

    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [isFocusMode]);

  return {
    containerRef,
    placeholderHeight: normalModeHeightRef.current,
  };
}
