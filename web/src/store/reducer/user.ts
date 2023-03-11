import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { cloneDeep } from "lodash-es";

interface State {
  // host is the user who hist the system
  host?: User;
  // user is the user who is currently logged in
  user?: User;
  userById: { [key: UserId]: User };
}

const userSlice = createSlice({
  name: "user",
  initialState: {
    userById: {},
  } as State,
  reducers: {
    setHost: (state, action: PayloadAction<User | undefined>) => {
      return {
        ...state,
        host: action.payload,
      };
    },
    setUser: (state, action: PayloadAction<User | undefined>) => {
      return {
        ...state,
        user: action.payload,
      };
    },
    setUserById: (state, action: PayloadAction<User>) => {
      const userById = cloneDeep(state.userById);
      userById[action.payload.id] = action.payload;
      return {
        ...state,
        userById: userById,
      };
    },
    patchUser: (state, action: PayloadAction<Partial<User>>) => {
      return {
        ...state,
        user: {
          ...state.user,
          ...action.payload,
        } as User,
      };
    },
  },
});

export const { setHost, setUser, setUserById, patchUser } = userSlice.actions;

export default userSlice.reducer;
