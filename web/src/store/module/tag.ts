import * as api from "@/helpers/api";
import store, { useAppSelector } from "..";
import { deleteTag, setTags, upsertTag } from "../reducer/tag";
import { useUserStore } from "./";

export const useTagStore = () => {
  const state = useAppSelector((state) => state.tag);
  const userStore = useUserStore();
  return {
    state,
    getState: () => {
      return store.getState().tag;
    },
    fetchTags: async () => {
      const tagFind: TagFind = {};
      if (userStore.isVisitorMode()) {
        tagFind.creatorId = userStore.getUserIdFromPath();
      }
      const { data } = (await api.getTagList(tagFind)).data;
      store.dispatch(setTags(data));
    },
    upsertTag: async (tagName: string) => {
      await api.upsertTag(tagName);
      store.dispatch(upsertTag(tagName));
    },
    deleteTag: async (tagName: string) => {
      await api.deleteTag(tagName);
      store.dispatch(deleteTag(tagName));
    },
  };
};
