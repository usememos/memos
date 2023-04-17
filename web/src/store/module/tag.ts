import * as api from "@/helpers/api";
import store, { useAppSelector } from "..";
import { deleteTag, setTags, upsertTag } from "../reducer/tag";
import { useUserStore } from "./";
import { isString } from "lodash-es";

export const useTagStore = () => {
  const state = useAppSelector((state) => state.tag);
  const userStore = useUserStore();

  const checkTagNameIsDuplicated = async (tagName: string): Promise<boolean | string> => {
    tagName = tagName.toLowerCase().replace(/[.,/#!$%^&*;:{}?=\-_`~()]/g, "");
    const data = await getTags();
    if (!data.includes(tagName)) {
      return tagName;
    }
    return false;
  };

  const getTags = async (): Promise<string[]> => {
    const tagFind: TagFind = {};
    if (userStore.isVisitorMode()) {
      tagFind.creatorId = userStore.getUserIdFromPath();
    }
    const { data } = (await api.getTagList(tagFind)).data;
    return data;
  };

  return {
    state,
    getState: () => {
      return store.getState().tag;
    },
    fetchTags: async () => {
      const data = await getTags();
      store.dispatch(setTags(data));
    },
    upsertTag: async (tagName: string) => {
      const retValue = await checkTagNameIsDuplicated(tagName);
      if (!!retValue && isString(retValue)) {
        await api.upsertTag(retValue);
        store.dispatch(upsertTag(retValue));
      }
    },
    deleteTag: async (tagName: string) => {
      await api.deleteTag(tagName);
      store.dispatch(deleteTag(tagName));
    },
  };
};
