import React, { DependencyList, EffectCallback, useEffect, useRef } from "react";

const useIsoMorphicEffect = (effect: EffectCallback, deps?: DependencyList | undefined) => {
  useEffect(effect, deps);
};

function useLatestValue<T>(value: T) {
  const cache = useRef(value);

  useIsoMorphicEffect(() => {
    cache.current = value;
  }, [value]);

  return cache;
}

// TODO: Add React.useEvent ?? once the useEvent hook is available
function useEvent<F extends (...args: any[]) => any, P extends any[] = Parameters<F>, R = ReturnType<F>>(cb: (...args: P) => R) {
  const cache = useLatestValue(cb);
  return React.useCallback((...args: P) => cache.current(...args), [cache]);
}

export default useEvent;
