import store from "../store";
import { setEditMemoId, setMemoVisibility } from "../store/modules/editor";

const editorStateService = {
  getState: () => {
    return store.getState().editor;
  },

  setEditMemoWithId: (editMemoId: MemoId) => {
    store.dispatch(setEditMemoId(editMemoId));
  },

  clearEditMemo: () => {
    store.dispatch(setEditMemoId());
  },

  setMemoVisibility: (memoVisibility: Visibility) => {
    store.dispatch(setMemoVisibility(memoVisibility));
  },
};

export default editorStateService;
