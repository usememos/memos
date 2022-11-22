import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface State {
  locale: Locale;
  systemStatus: SystemStatus;
}

const globalSlice = createSlice({
  name: "global",
  initialState: {
    locale: "en",
    systemStatus: {
      host: undefined,
      profile: {
        mode: "dev",
        version: "",
      },
      dbSize: 0,
      allowSignUp: false,
      additionalStyle: "",
      additionalScript: "",
    },
  } as State,
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
