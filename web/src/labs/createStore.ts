export type State = Readonly<Object>;
export type Action = {
  type: string;
  payload: any;
};

export type Reducer<S extends State, A extends Action> = (s: S, a: A) => S;
type Listener<S extends State> = (ns: S, ps?: S) => void;
type Unsubscribe = () => void;

export interface Store<S extends State, A extends Action> {
  dispatch: (a: A) => void;
  getState: () => S;
  subscribe: (listener: Listener<S>) => Unsubscribe;
}

/**
 * 简单实现的 Redux
 * @param preloadedState 初始 state
 * @param reducer reducer pure function
 * @returns store
 */
function createStore<S extends State, A extends Action>(preloadedState: S, reducer: Reducer<S, A>): Store<Readonly<S>, A> {
  const listeners: Listener<S>[] = [];
  let currentState = preloadedState;

  const dispatch = (action: A) => {
    const nextState = reducer(currentState, action);
    const prevState = currentState;
    currentState = nextState;

    for (const cb of listeners) {
      cb(currentState, prevState);
    }
  };

  const subscribe = (listener: Listener<S>) => {
    let isSubscribed = true;
    listeners.push(listener);

    return () => {
      if (!isSubscribed) {
        return;
      }

      const index = listeners.indexOf(listener);
      listeners.splice(index, 1);
      isSubscribed = false;
    };
  };

  const getState = () => {
    return currentState;
  };

  return {
    dispatch,
    getState,
    subscribe,
  };
}

export default createStore;
