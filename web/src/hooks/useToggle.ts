import { useCallback, useState } from "react";

// Parameter is the boolean, with default "false" value
export default function useToggle(initialState = false): [boolean, (nextState?: boolean) => void] {
  // Initialize the state
  const [state, setState] = useState(initialState);

  // Define and memorize toggler function in case we pass down the comopnent,
  // This function change the boolean value to it's opposite value
  const toggle = useCallback((nextState?: boolean) => {
    if (nextState !== undefined) {
      setState(nextState);
    } else {
      setState((state) => !state);
    }
  }, []);

  return [state, toggle];
}
