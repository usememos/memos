import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { uniqBy } from "lodash-es";

interface State {
  memos: Memo[];
}

const memoSlice = createSlice({
  name: "memo",
  initialState: {
    memos: [],
  } as State,
  reducers: {
    upsertMemos: (state, action: PayloadAction<Memo[]>) => {
      return {
        ...state,
        memos: uniqBy([...state.memos, ...action.payload], "id"),
      };
    },
    createMemo: (state, action: PayloadAction<Memo>) => {
      return {
        ...state,
        memos: state.memos.concat(action.payload),
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
    deleteMemo: (state, action: PayloadAction<MemoId>) => {
      return {
        ...state,
        memos: state.memos.filter((memo) => {
          return memo.id !== action.payload;
        }),
      };
    },
  },
});

export const { upsertMemos, createMemo, patchMemo, deleteMemo } = memoSlice.actions;

export default memoSlice.reducer;
