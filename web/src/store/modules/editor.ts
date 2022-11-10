import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface State {
  markMemoId?: MemoId;
  editMemoId?: MemoId;
  memoVisibility: Visibility;
}

const editorSlice = createSlice({
  name: "editor",
  initialState: {} as State,
  reducers: {
    setMarkMemoId: (state, action: PayloadAction<Option<MemoId>>) => {
      return {
        ...state,
        markMemoId: action.payload,
      };
    },
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

export const { setEditMemoId, setMarkMemoId, setMemoVisibility } = editorSlice.actions;

export default editorSlice.reducer;
