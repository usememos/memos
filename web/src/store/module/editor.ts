import store, { useAppSelector } from "..";
import { setEditMemoId, setMemoVisibility, setRelationList, setResourceList } from "../reducer/editor";

export const useEditorStore = () => {
  const state = useAppSelector((state) => state.editor);

  return {
    state,
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
    setRelationList: (relationList: MemoRelation[]) => {
      store.dispatch(setRelationList(relationList));
    },
  };
};
