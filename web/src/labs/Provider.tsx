import { useEffect, useState } from "react";
import { Store } from "./createStore";

interface Props {
  children: React.ReactElement;
  store: Store<any, any>;
  context: React.Context<any>;
}

/**
 * Toy-Redux Provider
 * Just for debug with the app store
 */
const Provider: React.FC<Props> = (props: Props) => {
  const { children, store, context: Context } = props;
  const [appState, setAppState] = useState(store.getState());

  useEffect(() => {
    const unsubscribe = store.subscribe((ns) => {
      setAppState(ns);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return <Context.Provider value={appState}>{children}</Context.Provider>;
};

export default Provider;
