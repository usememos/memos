import store from "../store";
import { setEditMemoId, setMarkMemoId } from "../store/modules/editor";

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

  setMarkMemoWithId: (markMemoId: MemoId) => {
    store.dispatch(setMarkMemoId(markMemoId));
  },

  clearMarkMemo: () => {
    store.dispatch(setMarkMemoId());
  },
};

export default editorStateService;
