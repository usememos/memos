import store from "../store";
import { setEditMemoId, setMemoVisibility, setResourceList } from "../store/modules/editor";

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

  setResourceList: (resourceList: Resource[]) => {
    store.dispatch(setResourceList(resourceList));
  },

  clearResourceList: () => {
    store.dispatch(setResourceList([]));
  },
};

export default editorStateService;
