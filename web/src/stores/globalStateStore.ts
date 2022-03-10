export interface AppSetting {
  shouldSplitMemoWord: boolean;
  shouldHideImageUrl: boolean;
  shouldUseMarkdownParser: boolean;
  useTinyUndoHistoryCache: boolean;
}

export interface State extends AppSetting {
  markMemoId: string;
  editMemoId: string;
}

interface SetMarkMemoIdAction {
  type: "SET_MARK_MEMO_ID";
  payload: {
    markMemoId: string;
  };
}

interface SetEditMemoIdAction {
  type: "SET_EDIT_MEMO_ID";
  payload: {
    editMemoId: string;
  };
}

interface SetAppSettingAction {
  type: "SET_APP_SETTING";
  payload: Partial<AppSetting>;
}

export type Actions = SetEditMemoIdAction | SetMarkMemoIdAction | SetAppSettingAction;

export function reducer(state: State, action: Actions) {
  switch (action.type) {
    case "SET_MARK_MEMO_ID": {
      if (action.payload.markMemoId === state.markMemoId) {
        return state;
      }

      return {
        ...state,
        markMemoId: action.payload.markMemoId,
      };
    }
    case "SET_EDIT_MEMO_ID": {
      if (action.payload.editMemoId === state.editMemoId) {
        return state;
      }

      return {
        ...state,
        editMemoId: action.payload.editMemoId,
      };
    }
    case "SET_APP_SETTING": {
      return {
        ...state,
        ...action.payload,
      };
    }
    default: {
      return state;
    }
  }
}

export const defaultState: State = {
  markMemoId: "",
  editMemoId: "",
  shouldSplitMemoWord: true,
  shouldHideImageUrl: true,
  shouldUseMarkdownParser: true,
  useTinyUndoHistoryCache: false,
};
