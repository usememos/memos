import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Visibility } from "@/types/proto/api/v2/memo_service";

interface State {
  tag?: string;
  text?: string;
  visibility?: Visibility;
}

export type Filter = State;

const getInitialState = (): State => {
  const state: State = {};
  const urlParams = new URLSearchParams(location.search);
  const tag = urlParams.get("tag");
  const text = urlParams.get("text");
  if (tag) {
    state.tag = tag;
  }
  if (text) {
    state.text = text;
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
