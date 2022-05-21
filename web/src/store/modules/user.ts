import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface State {
  user?: User;
}

const userSlice = createSlice({
  name: "user",
  initialState: {} as State,
  reducers: {
    signin: (state, action: PayloadAction<User>) => {
      return {
        ...state,
        user: action.payload,
      };
    },
    signout: (state) => {
      return {
        ...state,
        user: undefined,
      };
    },
    patchUser: (state, action: PayloadAction<Partial<User>>) => {
      state.user = {
        ...state.user,
        ...action.payload,
      } as User;
    },
  },
});

export const { signin, signout, patchUser } = userSlice.actions;

export default userSlice.reducer;
