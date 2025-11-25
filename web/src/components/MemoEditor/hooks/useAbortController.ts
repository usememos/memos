import { useEffect, useRef } from "react";

/**
 * Custom hook for managing AbortController lifecycle
 * Useful for canceling async operations like fetch requests
 *
 * @returns Object with methods to create and abort requests
 *
 * @example
 * ```tsx
 * const { getSignal, abort, abortAndCreate } = useAbortController();
 *
 * // Create signal for fetch
 * const signal = getSignal();
 * fetch(url, { signal });
 *
 * // Cancel on user action
 * abort();
 *
 * // Or cancel previous and create new
 * const newSignal = abortAndCreate();
 * fetch(newUrl, { signal: newSignal });
 * ```
 */
export function useAbortController() {
  const controllerRef = useRef<AbortController | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  /**
   * Aborts the current request if one exists
   */
  const abort = (): void => {
    controllerRef.current?.abort();
    controllerRef.current = null;
  };

  /**
   * Creates a new AbortController and returns its signal
   * Does not abort previous controller
   */
  const create = (): AbortSignal => {
    const controller = new AbortController();
    controllerRef.current = controller;
    return controller.signal;
  };

  /**
   * Aborts current request and creates a new AbortController
   * Useful for debounced requests
   */
  const abortAndCreate = (): AbortSignal => {
    abort();
    return create();
  };

  /**
   * Gets the signal from the current controller, or creates new one
   */
  const getSignal = (): AbortSignal => {
    if (!controllerRef.current) {
      return create();
    }
    return controllerRef.current.signal;
  };

  return {
    abort,
    create,
    abortAndCreate,
    getSignal,
  };
}
