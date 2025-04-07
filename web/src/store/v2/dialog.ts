import { last } from "lodash-es";
import { makeAutoObservable, runInAction } from "mobx";

class LocalState {
  stack: string[] = [];

  constructor() {
    makeAutoObservable(this);
  }

  setPartial(partial: Partial<LocalState>) {
    Object.assign(this, partial);
  }
}

const dialogStore = (() => {
  const state = new LocalState();

  const pushDialog = (name: string) => {
    runInAction(() => state.stack.push(name));
  };

  const popDialog = () => runInAction(() => state.stack.pop());

  const removeDialog = (name: string) => {
    runInAction(() => (state.stack = state.stack.filter((n) => n !== name)));
  };

  const topDialog = last(state.stack);

  return {
    state,
    topDialog,
    pushDialog,
    popDialog,
    removeDialog,
  };
})();

export default dialogStore;
