import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface State {
  markMemoId?: MemoId;
  editMemoId?: MemoId;
}

const editorSlice = createSlice({
  name: "editor",
  initialState: {} as State,
  reducers: {
    setMarkMemoId: (state, action: PayloadAction<Option<MemoId>>) => {
      state.markMemoId = action.payload;
    },
    setEditMemoId: (state, action: PayloadAction<Option<MemoId>>) => {
      state.editMemoId = action.payload;
    },
  },
});

export const { setEditMemoId, setMarkMemoId } = editorSlice.actions;

export default editorSlice.reducer;
