import store from "../store";
import { setEditMemoId, setMarkMemoId } from "../store/modules/editor";

const editorStateService = {
  getState: () => {
    return store.getState().editor;
  },

  setEditMemo: (editMemoId: MemoId) => {
    store.dispatch(setEditMemoId(editMemoId));
  },

  setMarkMemo: (markMemoId: MemoId) => {
    store.dispatch(setMarkMemoId(markMemoId));
  },
};

export default editorStateService;
