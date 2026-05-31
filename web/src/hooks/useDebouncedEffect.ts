import { type DependencyList, useEffect, useRef } from "react";

export const useDebouncedEffect = (effect: () => void | Promise<void>, delay: number, deps: DependencyList): void => {
  const effectRef = useRef(effect);
  effectRef.current = effect;

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void effectRef.current();
    }, delay);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [delay, ...deps]);
};
