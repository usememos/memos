import { useEffect, useRef, useState } from "react";

export const useOverflowTitle = <T extends HTMLElement>(text: string) => {
  const ref = useRef<T>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const checkOverflow = () => setIsOverflowing(element.scrollWidth > element.clientWidth);
    checkOverflow();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(checkOverflow);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text]);

  return { ref, title: isOverflowing ? text : undefined };
};
