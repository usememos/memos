import { useEffect, useRef } from "react";

export function useAbortController() {
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const abort = () => {
    controllerRef.current?.abort();
    controllerRef.current = null;
  };

  const abortAndCreate = (): AbortSignal => {
    abort();
    controllerRef.current = new AbortController();
    return controllerRef.current.signal;
  };

  return { abort, abortAndCreate };
}
