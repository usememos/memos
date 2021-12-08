import { useEffect, useState } from "react";

type State = Readonly<Object>;
interface Action {
  type: string;
}
type Listener<S extends State> = (ns: S, ps?: S) => void;

interface Store<S extends State, A extends Action> {
  dispatch: (a: A) => void;
  getState: () => S;
  subscribe: (listener: Listener<S>) => () => void;
}

export default function useSelector<S extends State, A extends Action>(store: Store<S, A>): S {
  const [state, setState] = useState(store.getState());

  useEffect(() => {
    const unsubscribe = store.subscribe((ns) => {
      setState(ns);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return state;
}
