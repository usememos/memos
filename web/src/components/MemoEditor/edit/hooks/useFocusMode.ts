import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { FOCUS_MODE_STYLES } from "../constants";

/**
 * Manages the DOM-only parts of focus mode: body scroll locking, a measured
 * placeholder height that keeps masonry/grid layouts stable while the editor
 * itself is fixed above the page, and the view transition that grows the frame
 * out of its place on the page and back.
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

  const transitionRef = useRef<ViewTransition | null>(null);
  /**
   * Runs `toggle` as a view transition: the frame alone carries a transition name,
   * so it morphs between its place on the page and the focus sheet while the page
   * cross-fades under the backdrop. Without view transitions it simply toggles.
   */
  const animateFocusMode = useCallback((toggle: () => void) => {
    const container = containerRef.current;
    if (!container || !document.startViewTransition) {
      toggle();
      return;
    }
    // Named only while it runs: several sessions can be on a page, and a name must be unique.
    container.style.viewTransitionName = FOCUS_MODE_STYLES.transitionName;
    const transition = document.startViewTransition(() => flushSync(toggle));
    transitionRef.current = transition;
    // A second toggle mid-flight skips this transition and rejects `ready`.
    transition.ready.catch(() => {});
    void transition.finished.finally(() => {
      // A skipped transition finishes while the next one still needs the name.
      if (transitionRef.current !== transition) return;
      transitionRef.current = null;
      container.style.viewTransitionName = "";
    });
  }, []);

  return {
    containerRef,
    placeholderHeight: normalModeHeightRef.current,
    animateFocusMode,
  };
}
