import { last } from "lodash-es";
import { makeAutoObservable } from "mobx";

const dialogStore = (() => {
  const state = makeAutoObservable<{
    stack: string[];
  }>({
    stack: [],
  });

  const pushDialog = (name: string) => {
    state.stack.push(name);
  };

  const popDialog = () => state.stack.pop();

  const removeDialog = (name: string) => {
    state.stack = state.stack.filter((n) => n !== name);
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
