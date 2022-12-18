import store, { useAppSelector } from "..";
import { pushDialogStack, popDialogStack } from "../reducer/dialog";
import { last } from "lodash";

export const useDialogStore = () => {
  const state = useAppSelector((state) => state.editor);

  return {
    state,
    getState: () => {
      return store.getState().dialog;
    },
    pushDialogStack: (dialogName: string) => {
      store.dispatch(pushDialogStack(dialogName));
    },
    popDialogStack: () => {
      store.dispatch(popDialogStack());
    },
    topDialogStack: () => {
      return last(store.getState().dialog.dialogStack);
    },
  };
};
