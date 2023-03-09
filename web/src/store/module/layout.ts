import store, { useAppSelector } from "..";
import { setHeaderStatus, setHomeSidebarStatus } from "../reducer/layout";

export const useLayoutStore = () => {
  const state = useAppSelector((state) => state.layout);
  return {
    state,
    getState: () => {
      return store.getState().tag;
    },
    setHeaderStatus: (showHeader: boolean) => {
      store.dispatch(setHeaderStatus(showHeader));
    },
    setHomeSidebarStatus: (showHomeSidebar: boolean) => {
      store.dispatch(setHomeSidebarStatus(showHomeSidebar));
    },
  };
};
