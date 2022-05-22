import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface State {
  memos: Memo[];
  tags: string[];
}

const memoSlice = createSlice({
  name: "memo",
  initialState: {
    memos: [],
    tags: [],
  } as State,
  reducers: {
    setMemos: (state, action: PayloadAction<Memo[]>) => {
      state.memos = action.payload;
    },
    setTags: (state, action: PayloadAction<string[]>) => {
      state.tags = action.payload;
    },
    createMemo: (state, action: PayloadAction<Memo>) => {
      state.memos = state.memos.concat(action.payload);
    },
    patchMemo: (state, action: PayloadAction<Partial<Memo>>) => {
      state.memos = state.memos.map((m) => {
        if (m.id === action.payload.id) {
          return {
            ...m,
            ...action.payload,
          };
        } else {
          return m;
        }
      });
    },
  },
});

export const { setMemos, setTags, createMemo, patchMemo } = memoSlice.actions;

export default memoSlice.reducer;
