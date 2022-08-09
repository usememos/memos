type I18nState = Readonly<{
  locale: string;
}>;

type Listener = (ns: I18nState, ps?: I18nState) => void;

const createI18nStore = (preloadedState: I18nState) => {
  const listeners: Listener[] = [];
  let currentState = preloadedState;

  const getState = () => {
    return currentState;
  };

  const setState = (state: Partial<I18nState>) => {
    const nextState = {
    ...currentState,
    ...state,
    };
    const prevState = currentState;
    currentState = nextState;

    for (const cb of listeners) {
    cb(currentState, prevState);
    }
  };

  const subscribe = (listener: Listener) => {
    let isSubscribed = true;
    listeners.push(listener);

    const unsubscribe = () => {
    if (!isSubscribed) {
        return;
    }

    const index = listeners.indexOf(listener);
    listeners.splice(index, 1);
    isSubscribed = false;
    };

    return unsubscribe;
  };

  return {
    getState,
    setState,
    subscribe,
  };
};

export default createI18nStore;
