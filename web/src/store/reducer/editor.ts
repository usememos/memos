import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface State {
  memoVisibility: Visibility;
  resourceList: Resource[];
  editMemoId?: MemoId;
}

const editorSlice = createSlice({
  name: "editor",
  initialState: {
    memoVisibility: "PRIVATE",
    resourceList: [],
  } as State,
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
    setResourceList: (state, action: PayloadAction<Resource[]>) => {
      return {
        ...state,
        resourceList: action.payload,
      };
    },
  },
});

export const { setEditMemoId, setMemoVisibility, setResourceList } = editorSlice.actions;

export default editorSlice.reducer;
