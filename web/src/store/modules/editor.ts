import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface State {
  editMemoId?: MemoId;
  memoVisibility: Visibility;
}

const editorSlice = createSlice({
  name: "editor",
  initialState: {} as State,
  reducers: {
    setEditMemoId: (state, action: PayloadAction<Option<MemoId>>) => {
      return {
        ...state,
        editMemoId: action.payload,
      };
    },
    setMemoVisibility: (state, action: PayloadAction<Visibility>) => {
      return {
        ...state,
        memoVisibility: action.payload,
      };
    },
  },
});

export const { setEditMemoId, setMemoVisibility } = editorSlice.actions;

export default editorSlice.reducer;
