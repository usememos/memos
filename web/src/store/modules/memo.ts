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
      return {
        ...state,
        memos: action.payload.filter((m) => m.rowStatus === "NORMAL").sort((a, b) => b.createdTs - a.createdTs),
      };
    },
    createMemo: (state, action: PayloadAction<Memo>) => {
      return {
        ...state,
        memos: state.memos.concat(action.payload).sort((a, b) => b.createdTs - a.createdTs),
      };
    },
    patchMemo: (state, action: PayloadAction<Partial<Memo>>) => {
      return {
        ...state,
        memos: state.memos
          .map((memo) => {
            if (memo.id === action.payload.id) {
              return {
                ...memo,
                ...action.payload,
              };
            } else {
              return memo;
            }
          })
          .filter((memo) => memo.rowStatus === "NORMAL"),
      };
    },
    setTags: (state, action: PayloadAction<string[]>) => {
      return {
        ...state,
        tags: action.payload,
      };
    },
  },
});

export const { setMemos, setTags, createMemo, patchMemo } = memoSlice.actions;

export default memoSlice.reducer;
