import store, { useAppSelector } from "..";
import { setHomeSidebarStatus } from "../reducer/layout";

export const useLayoutStore = () => {
  const state = useAppSelector((state) => state.layout);
  return {
    state,
    getState: () => {
      return store.getState().tag;
    },
    setHomeSidebarStatus: (showHomeSidebar: boolean) => {
      store.dispatch(setHomeSidebarStatus(showHomeSidebar));
    },
  };
};
