import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface Duration {
  from: number;
  to: number;
}

export interface Query {
  tag?: string;
  duration?: Duration;
  type?: MemoSpecType;
  text?: string;
  shortcutId?: ShortcutId;
  visibility?: Visibility;
}

interface State {
  pathname: string;
  hash: string;
  query: Query;
}

const getValidPathname = (pathname: string): string => {
  const userPageUrlRegex = /^\/u\/\d+.*/;
  if (["/", "/auth", "/explore"].includes(pathname) || userPageUrlRegex.test(pathname)) {
    return pathname;
  } else {
    return "/";
  }
};

const getStateFromLocation = () => {
  const { pathname, search, hash } = window.location;
  const urlParams = new URLSearchParams(search);
  const state: State = {
    pathname: getValidPathname(pathname),
    hash: hash,
    query: {},
  };

  if (search !== "") {
    state.query = {};
    state.query.tag = urlParams.get("tag") ?? undefined;
    state.query.type = (urlParams.get("type") as MemoSpecType) ?? undefined;
    state.query.text = urlParams.get("text") ?? undefined;
    const shortcutIdStr = urlParams.get("shortcutId");
    state.query.shortcutId = shortcutIdStr ? Number(shortcutIdStr) : undefined;
    const from = parseInt(urlParams.get("from") ?? "0");
    const to = parseInt(urlParams.get("to") ?? "0");
    if (to > from && to !== 0) {
      state.query.duration = {
        from,
        to,
      };
    }
    state.query.visibility = (urlParams.get("visibility") as Visibility) ?? undefined;
  }

  return state;
};

const locationSlice = createSlice({
  name: "location",
  initialState: getStateFromLocation(),
  reducers: {
    updateStateWithLocation: () => {
      return getStateFromLocation();
    },
    updatePathnameStateWithLocation: (state) => {
      const { pathname } = window.location;
      return {
        ...state,
        pathname: getValidPathname(pathname),
      };
    },
    setPathname: (state, action: PayloadAction<string>) => {
      if (state.pathname === action.payload) {
        return state;
      }

      return {
        ...state,
        pathname: action.payload,
      };
    },
    setQuery: (state, action: PayloadAction<Partial<Query>>) => {
      if (JSON.stringify(action.payload) === state.query) {
        return state;
      }

      return {
        ...state,
        query: {
          ...state.query,
          ...action.payload,
        },
      };
    },
  },
});

export const { setPathname, setQuery, updateStateWithLocation, updatePathnameStateWithLocation } = locationSlice.actions;

export default locationSlice.reducer;
