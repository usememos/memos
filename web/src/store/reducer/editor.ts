import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface State {
  memoVisibility: Visibility;
  resourceList: Resource[];
  relationList: MemoRelation[];
  editMemoId?: MemoId;
}

const editorSlice = createSlice({
  name: "editor",
  initialState: {
    memoVisibility: "PRIVATE",
    resourceList: [],
    relationList: [],
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
    setRelationList: (state, action: PayloadAction<MemoRelation[]>) => {
      return {
        ...state,
        relationList: action.payload,
      };
    },
  },
});

export const { setEditMemoId, setMemoVisibility, setResourceList, setRelationList } = editorSlice.actions;

export default editorSlice.reducer;
