import React, { useEffect, useRef, EffectCallback, DependencyList } from "react";

const useIsoMorphicEffect = (effect: EffectCallback, deps?: DependencyList | undefined) => {
  useEffect(effect, deps);
};

export default function useLatestValue<T>(value: T) {
  const cache = useRef(value);

  useIsoMorphicEffect(() => {
    cache.current = value;
  }, [value]);

  return cache;
}

export const useEvent =
  // TODO: Add React.useEvent ?? once the useEvent hook is available
  function useEvent<F extends (...args: any[]) => any, P extends any[] = Parameters<F>, R = ReturnType<F>>(cb: (...args: P) => R) {
    const cache = useLatestValue(cb);
    return React.useCallback((...args: P) => cache.current(...args), [cache]);
  };
