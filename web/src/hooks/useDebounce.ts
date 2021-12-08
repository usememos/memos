import { useCallback, useRef } from "react";

/**
 * useDebounce: useRef + useCallback
 * @param func function
 * @param delay delay duration
 * @param deps depends
 * @returns debounced function
 */
export default function useDebounce<T extends (...args: any[]) => any>(func: T, delay: number, deps: any[] = []): T {
  const timer = useRef<number>();

  const cancel = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
    }
  }, []);

  const run = useCallback((...args) => {
    cancel();
    timer.current = window.setTimeout(() => {
      func(...args);
    }, delay);
  }, deps);

  return run as T;
}
