import { useEffect, EffectCallback, DependencyList } from "react";

const useIsoMorphicEffect = (effect: EffectCallback, deps?: DependencyList | undefined) => {
  useEffect(effect, deps);
};

export default useIsoMorphicEffect;
