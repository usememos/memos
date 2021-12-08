import { Action, Reducer, State } from "./createStore";

interface ReducersMapObject<S extends State = any, A extends Action = any> {
  [key: string]: Reducer<S, A>;
}

type StateFromReducersMapObject<M> = M extends ReducersMapObject
  ? { [P in keyof M]: M[P] extends Reducer<infer S, any> ? S : never }
  : never;

function combineReducers<S extends State, A extends Action>(reducers: ReducersMapObject): Reducer<S, A> {
  const reducerKeys = Object.keys(reducers);
  const finalReducersObj: ReducersMapObject = {};

  for (const key of reducerKeys) {
    if (typeof reducers[key] === "function") {
      finalReducersObj[key] = reducers[key];
    }
  }

  return ((state: StateFromReducersMapObject<typeof reducers> = {}, action: A) => {
    let hasChanged = false;
    const nextState: StateFromReducersMapObject<typeof reducers> = {};

    for (const key of reducerKeys) {
      const prevStateForKey = state[key];
      const nextStateForKey = finalReducersObj[key](prevStateForKey, action);
      nextState[key] = nextStateForKey;
      hasChanged = hasChanged || nextStateForKey !== prevStateForKey;
    }

    return hasChanged ? nextState : state;
  }) as any as Reducer<S, A>;
}

export default combineReducers;
