import { DependencyList, useEffect } from "react";

const useAsyncEffect = (effect: () => void | Promise<void>, deps?: DependencyList): void => {
  useEffect(() => {
    effect();
  }, deps);
};

export default useAsyncEffect;
