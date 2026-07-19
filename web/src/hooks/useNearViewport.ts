import { type RefObject, useEffect, useRef, useState } from "react";

const DEFAULT_ROOT_MARGIN = "400px 0px";

interface UseNearViewportOptions {
  rootMargin?: string;
}

interface UseNearViewportResult<T extends Element> {
  ref: RefObject<T | null>;
  isNearViewport: boolean;
}

/**
 * Turns true once the observed element approaches the viewport. The flag stays
 * true after the first intersection so callers can safely start one-way work
 * such as data fetching without cancelling it when the element scrolls away.
 */
export function useNearViewport<T extends Element>(options: UseNearViewportOptions = {}): UseNearViewportResult<T> {
  const { rootMargin = DEFAULT_ROOT_MARGIN } = options;
  const ref = useRef<T>(null);
  const [isNearViewport, setIsNearViewport] = useState(false);

  useEffect(() => {
    if (isNearViewport) {
      return;
    }

    const element = ref.current;
    if (!element) {
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      setIsNearViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return;
        }

        setIsNearViewport(true);
        observer.disconnect();
      },
      { rootMargin },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [isNearViewport, rootMargin]);

  return { ref, isNearViewport };
}
