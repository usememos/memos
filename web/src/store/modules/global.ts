import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface State {
  locale: Locale;
  appearance: Appearance;
  systemStatus: SystemStatus;
  dialogStack: string[];
}

const globalSlice = createSlice({
  name: "global",
  initialState: {
    locale: "en",
    appearance: "system",
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
    dialogStack: [],
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
    setAppearance: (state, action: PayloadAction<Appearance>) => {
      return {
        ...state,
        appearance: action.payload,
      };
    },
    pushDialogStack: (state, action: PayloadAction<string>) => {
      return {
        ...state,
        dialogStack: [...state.dialogStack, action.payload],
      };
    },
    popDialogStack: (state) => {
      return {
        ...state,
        dialogStack: state.dialogStack.slice(0, state.dialogStack.length - 1),
      };
    },
  },
});

export const { setGlobalState, setLocale, setAppearance, pushDialogStack, popDialogStack } = globalSlice.actions;

export default globalSlice.reducer;
