import utils from "../helpers/utils";
import store from "../store";
import { setQuery, setPathname } from "../store/modules/location";

const updateLocationUrl = (method: "replace" | "push" = "replace") => {
  const { query, pathname, hash } = store.getState().location;
  let queryString = utils.transformObjectToParamsString(query ?? {});
  if (queryString) {
    queryString = "?" + queryString;
  } else {
    queryString = "";
  }

  if (method === "replace") {
    window.history.replaceState(null, "", pathname + hash + queryString);
  } else {
    window.history.pushState(null, "", pathname + hash + queryString);
  }
};

const locationService = {
  getState: () => {
    return store.getState().location;
  },

  clearQuery: () => {
    store.dispatch(setQuery({}));
    updateLocationUrl();
  },

  setQuery: (query: Query) => {
    store.dispatch(setQuery(query));
    updateLocationUrl();
  },

  setPathname: (pathname: AppRouter) => {
    store.dispatch(setPathname(pathname));
    updateLocationUrl();
  },

  pushHistory: (pathname: AppRouter) => {
    store.dispatch(setPathname(pathname));
    updateLocationUrl("push");
  },

  replaceHistory: (pathname: AppRouter) => {
    store.dispatch(setPathname(pathname));
    updateLocationUrl("replace");
  },

  setMemoTypeQuery: (type?: MemoSpecType) => {
    const { query } = store.getState().location;
    store.dispatch(
      setQuery({
        ...query,
        type: type,
      })
    );
    updateLocationUrl();
  },

  setMemoShortcut: (shortcutId?: ShortcutId) => {
    const { query } = store.getState().location;
    store.dispatch(
      setQuery({
        ...query,
        shortcutId: shortcutId,
      })
    );
    updateLocationUrl();
  },

  setTextQuery: (text?: string) => {
    const { query } = store.getState().location;
    store.dispatch(
      setQuery({
        ...query,
        text: text,
      })
    );
    updateLocationUrl();
  },

  setTagQuery: (tag?: string) => {
    const { query } = store.getState().location;
    store.dispatch(
      setQuery({
        ...query,
        tag: tag,
      })
    );
    updateLocationUrl();
  },

  setFromAndToQuery: (from: number, to: number) => {
    const { query } = store.getState().location;
    store.dispatch(
      setQuery({
        ...query,
        duration: { from, to },
      })
    );
    updateLocationUrl();
  },

  getValidPathname: (pathname: string): AppRouter => {
    if (["/", "/signin"].includes(pathname)) {
      return pathname as AppRouter;
    } else {
      return "/";
    }
  },
};

export default locationService;
