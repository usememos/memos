import { create } from "zustand";
import { combine } from "zustand/middleware";
import { tagServiceClient } from "@/grpcweb";

interface State {
  tags: Set<string>;
}

const getDefaultState = (): State => ({
  tags: new Set(),
});

export const useTagStore = create(
  combine(getDefaultState(), (set, get) => ({
    setState: (state: State) => set(state),
    getState: () => get(),
    fetchTags: async (options?: { skipCache: boolean }) => {
      const { tags: tagsCache } = get();
      if (tagsCache.size && !options?.skipCache) {
        return tagsCache;
      }
      const { tags } = await tagServiceClient.listTags({});
      set({ tags: new Set(tags.map((tag) => tag.name)) });
      return tags;
    },
    upsertTag: async (tagName: string) => {
      await tagServiceClient.upsertTag({
        name: tagName,
      });
      const { tags } = get();
      set({ tags: new Set([...tags, tagName]) });
    },
    batchUpsertTag: async (tagNames: string[]) => {
      await tagServiceClient.batchUpsertTag({
        requests: tagNames.map((name) => ({
          name,
        })),
      });
      const { tags } = get();
      set({ tags: new Set([...tags, ...tagNames]) });
    },
    deleteTag: async (tagName: string) => {
      await tagServiceClient.deleteTag({
        tag: {
          name: tagName,
        },
      });
      const { tags } = get();
      tags.delete(tagName);
      set({ tags });
    },
  })),
);
