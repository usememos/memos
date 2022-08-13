import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface State {
  locale: Locale;
}

const globalSlice = createSlice({
  name: "global",
  initialState: {} as State,
  reducers: {
    setGlobalState: (_, action: PayloadAction<State>) => {
      return action.payload;
    },
    setLocale: (state, action: PayloadAction<Locale>) => {
      return {
        ...state,
        locale: action.payload,
      };
    },
  },
});

export const { setGlobalState, setLocale } = globalSlice.actions;

export default globalSlice.reducer;
