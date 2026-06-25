import { useEffect, useState } from "react";

/**
 * Returns a flag that turns true only after `active` has stayed true for `delay` ms,
 * and turns false immediately once `active` becomes false.
 *
 * Useful for delaying loading indicators (e.g. skeletons) so they don't flash on fast operations.
 */
export const useDelayedFlag = (active: boolean, delay: number): boolean => {
  const [delayed, setDelayed] = useState(false);

  useEffect(() => {
    if (!active) {
      setDelayed(false);
      return;
    }

    const timeout = window.setTimeout(() => setDelayed(true), delay);
    return () => window.clearTimeout(timeout);
  }, [active, delay]);

  return delayed;
};
