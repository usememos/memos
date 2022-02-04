export interface State {
  user: Model.User | null;
}

interface SignInAction {
  type: "LOGIN";
  payload: State;
}

interface SignOutAction {
  type: "SIGN_OUT";
  payload: null;
}

interface ResetOpenIdAction {
  type: "RESET_OPENID";
  payload: string;
}

export type Actions = SignInAction | SignOutAction | ResetOpenIdAction;

export function reducer(state: State, action: Actions): State {
  switch (action.type) {
    case "LOGIN": {
      return {
        user: action.payload.user,
      };
    }
    case "SIGN_OUT": {
      return {
        user: null,
      };
    }
    case "RESET_OPENID": {
      if (!state.user) {
        return state;
      }

      return {
        user: {
          ...state.user,
          openId: action.payload,
        },
      };
    }
    default: {
      return state;
    }
  }
}

export const defaultState: State = { user: null };
