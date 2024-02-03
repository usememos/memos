import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface State {
  tag?: string;
  text?: string;
  ignore?: string;
  visibility?: Visibility;
}

export type Filter = State;

const getInitialState = (): State => {
  const state: State = {};
  const urlParams = new URLSearchParams(location.search);
  const tag = urlParams.get("tag");
  const text = urlParams.get("text");
  const ignore = urlParams.get("ignore");
  if (tag) {
    state.tag = tag;
  }
  if (text) {
    state.text = text;
  }
  if (ignore) {
    state.ignore = ignore;
  }
  return state;
};

const filterSlice = createSlice({
  name: "filter",
  initialState: getInitialState(),
  reducers: {
    setFilter: (state, action: PayloadAction<Partial<State>>) => {
      if (JSON.stringify(action.payload) === state) {
        return state;
      }

      return {
        ...state,
        ...action.payload,
      };
    },
  },
});

export const { setFilter } = filterSlice.actions;

export default filterSlice.reducer;
