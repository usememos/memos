import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { parse, ParsedQs } from "qs";

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
  const urlParams = parse(search.slice(1));
  const state: State = {
    pathname: getValidPathname(pathname),
    hash: hash,
    query: {},
  };

  if (search !== "") {
    state.query = {};
    state.query.tag = urlParams["tag"] as string;
    state.query.type = urlParams["type"] as MemoSpecType;
    state.query.text = urlParams["text"] as string;
    const shortcutIdStr = urlParams["shortcutId"] as string;
    state.query.shortcutId = shortcutIdStr ? Number(shortcutIdStr) : undefined;
    const durationObj = urlParams["duration"] as ParsedQs;
    if (durationObj) {
      const duration: Duration = {
        from: Number(durationObj["from"]),
        to: Number(durationObj["to"]),
      };
      if (duration.to > duration.from && duration.to !== 0) {
        state.query.duration = duration;
      }
    }
    state.query.visibility = urlParams["visibility"] as Visibility;
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
