import { useRef } from "react";
import useIsoMorphicEffect from "./use-iso-morphic-effect";

export default function useLatestValue<T>(value: T) {
  const cache = useRef(value);

  useIsoMorphicEffect(() => {
    cache.current = value;
  }, [value]);

  return cache;
}
