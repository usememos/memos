import utils from "../helpers/utils";
import appStore from "../stores/appStore";

const updateLocationUrl = (method: "replace" | "push" = "replace") => {
  const { query, pathname, hash } = appStore.getState().locationState;
  let queryString = utils.transformObjectToParamsString(query);
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

class LocationService {
  constructor() {
    this.updateStateWithLocation();
    window.onpopstate = () => {
      this.updateStateWithLocation();
    };
  }

  public updateStateWithLocation = () => {
    const { pathname, search, hash } = window.location;
    const urlParams = new URLSearchParams(search);
    const state: AppLocation = {
      pathname: "/",
      hash: "",
      query: {
        tag: "",
        duration: null,
        text: "",
        type: "",
        shortcutId: "",
      },
    };
    state.query.tag = urlParams.get("tag") ?? "";
    state.query.type = (urlParams.get("type") ?? "") as MemoSpecType;
    state.query.text = urlParams.get("text") ?? "";
    state.query.shortcutId = urlParams.get("filter") ?? "";
    const from = parseInt(urlParams.get("from") ?? "0");
    const to = parseInt(urlParams.get("to") ?? "0");
    if (to > from && to !== 0) {
      state.query.duration = {
        from,
        to,
      };
    }
    state.hash = hash;
    state.pathname = this.getValidPathname(pathname);
    appStore.dispatch({
      type: "SET_LOCATION",
      payload: state,
    });
  };

  public getState = () => {
    return appStore.getState().locationState;
  };

  public clearQuery = () => {
    appStore.dispatch({
      type: "SET_QUERY",
      payload: {
        tag: "",
        duration: null,
        text: "",
        type: "",
        shortcutId: "",
      },
    });

    updateLocationUrl();
  };

  public setQuery = (query: Query) => {
    appStore.dispatch({
      type: "SET_QUERY",
      payload: query,
    });

    updateLocationUrl();
  };

  public setHash = (hash: string) => {
    appStore.dispatch({
      type: "SET_HASH",
      payload: {
        hash,
      },
    });

    updateLocationUrl();
  };

  public setPathname = (pathname: string) => {
    appStore.dispatch({
      type: "SET_PATHNAME",
      payload: {
        pathname,
      },
    });

    updateLocationUrl();
  };

  public pushHistory = (pathname: string) => {
    appStore.dispatch({
      type: "SET_PATHNAME",
      payload: {
        pathname,
      },
    });

    updateLocationUrl("push");
  };

  public replaceHistory = (pathname: string) => {
    appStore.dispatch({
      type: "SET_PATHNAME",
      payload: {
        pathname,
      },
    });

    updateLocationUrl("replace");
  };

  public setMemoTypeQuery = (type: MemoSpecType | "" = "") => {
    appStore.dispatch({
      type: "SET_TYPE",
      payload: {
        type,
      },
    });

    updateLocationUrl();
  };

  public setMemoShortcut = (shortcutId: string) => {
    appStore.dispatch({
      type: "SET_SHORTCUT_ID",
      payload: shortcutId,
    });

    updateLocationUrl();
  };

  public setTextQuery = (text: string) => {
    appStore.dispatch({
      type: "SET_TEXT",
      payload: {
        text,
      },
    });

    updateLocationUrl();
  };

  public setTagQuery = (tag: string) => {
    appStore.dispatch({
      type: "SET_TAG_QUERY",
      payload: {
        tag,
      },
    });

    updateLocationUrl();
  };

  public setFromAndToQuery = (from: number, to: number) => {
    appStore.dispatch({
      type: "SET_DURATION_QUERY",
      payload: {
        duration: { from, to },
      },
    });

    updateLocationUrl();
  };

  public getValidPathname = (pathname: string): AppRouter => {
    if (["/", "/signin", "/trash", "/setting"].includes(pathname)) {
      return pathname as AppRouter;
    } else {
      return "/";
    }
  };
}

const locationService = new LocationService();

export default locationService;
