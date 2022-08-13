import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface State {
  locale: Locale;
}

const globalSlice = createSlice({
  name: "global",
  initialState: {} as State,
  reducers: {
    setLocale: (state, action: PayloadAction<Locale>) => {
      return {
        ...state,
        locale: action.payload,
      };
    },
  },
});

export const { setLocale } = globalSlice.actions;

export default globalSlice.reducer;
