import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface State {
  dialogStack: string[];
}

const dialogSlice = createSlice({
  name: "dialog",
  initialState: {
    dialogStack: [],
  } as State,
  reducers: {
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

export const { pushDialogStack, popDialogStack } = dialogSlice.actions;

export default dialogSlice.reducer;
