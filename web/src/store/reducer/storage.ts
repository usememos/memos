import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface State {
  smmsConfig: SMMSConfig;
}

const storageSlice = createSlice({
  name: "storage",
  initialState: {
    smmsConfig: {
      token: "",
    },
  } as State,
  reducers: {
    setStorageState: (state, action: PayloadAction<Partial<State>>) => {
      return {
        ...state,
        ...action.payload,
      };
    },
  },
});

export const { setStorageState } = storageSlice.actions;
export default storageSlice.reducer;
