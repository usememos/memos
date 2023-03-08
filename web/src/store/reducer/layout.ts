import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface State {
  showHeader: boolean;
  showHomeSidebar: boolean;
}

const layoutSlice = createSlice({
  name: "layout",
  initialState: {
    showHeader: false,
    showHomeSidebar: false,
  } as State,
  reducers: {
    setHeaderStatus: (state, action: PayloadAction<boolean>) => {
      return {
        ...state,
        showHeader: action.payload,
      };
    },
    setHomeSidebarStatus: (state, action: PayloadAction<boolean>) => {
      return {
        ...state,
        showHomeSidebar: action.payload,
      };
    },
  },
});

export const { setHeaderStatus, setHomeSidebarStatus } = layoutSlice.actions;

export default layoutSlice.reducer;
