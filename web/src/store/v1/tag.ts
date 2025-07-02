import { uniqueId } from "lodash-es";
import { create } from "zustand";
import { combine } from "zustand/middleware";
import { tagServiceClient } from "@/grpcweb";
import { Tag } from "@/types/proto/api/v1/tag_service";

interface State {
  // stateId is used to identify the store instance state.
  // It should be update when any state change.
  stateId: string;
  pinnedTags: Tag[];
  emojiTags: Tag[];
  pinnedTagsRequest: AbortController | null;
  emojiTagsRequest: AbortController | null;
}

const getDefaultState = (): State => ({
  stateId: uniqueId(),
  pinnedTags: [],
  emojiTags: [],
  pinnedTagsRequest: null,
  emojiTagsRequest: null,
});

export const useTagStore = create(
  combine(getDefaultState(), (set, get) => ({
    setState: (state: State) => set(state),
    getState: () => get(),
    updateStateId: () => set({ stateId: uniqueId() }),

    // Fetch pinned tags
    fetchPinnedTags: async () => {
      const currentRequest = get().pinnedTagsRequest;
      if (currentRequest) {
        currentRequest.abort();
      }

      const controller = new AbortController();
      set({ pinnedTagsRequest: controller });

      try {
        const { tags } = await tagServiceClient.listPinnedTags({}, { signal: controller.signal });

        if (!controller.signal.aborted) {
          // Server already returns tags sorted by pinned time (newest first)
          // No need to sort again, just use the server order
          set({ stateId: uniqueId(), pinnedTags: tags });
          return tags;
        }
      } catch (error: any) {
        if (error.name === "AbortError") {
          return;
        }
        throw error;
      } finally {
        if (get().pinnedTagsRequest === controller) {
          set({ pinnedTagsRequest: null });
        }
      }
    },

    // Fetch tags with emoji
    fetchEmojiTags: async () => {
      const currentRequest = get().emojiTagsRequest;
      if (currentRequest) {
        currentRequest.abort();
      }

      const controller = new AbortController();
      set({ emojiTagsRequest: controller });

      try {
        const { tags } = await tagServiceClient.listTagsWithEmoji({}, { signal: controller.signal });

        if (!controller.signal.aborted) {
          set({ stateId: uniqueId(), emojiTags: tags });
          return tags;
        }
      } catch (error: any) {
        if (error.name === "AbortError") {
          return;
        }
        throw error;
      } finally {
        if (get().emojiTagsRequest === controller) {
          set({ emojiTagsRequest: null });
        }
      }
    },

    // Pin a tag
    pinTag: async (tagName: string) => {
      const tag = await tagServiceClient.updateTag({
        tagName,
        pinned: true,
      });

      // Update pinned tags list - newly pinned tag should be at the top
      const pinnedTags = get().pinnedTags;
      const existingIndex = pinnedTags.findIndex((t) => t.tagName === tagName);

      let updatedPinnedTags: Tag[];
      if (existingIndex >= 0) {
        // Remove the tag from its current position and add it to the front
        updatedPinnedTags = [tag, ...pinnedTags.filter((t) => t.tagName !== tagName)];
      } else {
        // Add new pinned tag to the front
        updatedPinnedTags = [tag, ...pinnedTags];
      }

      set({ stateId: uniqueId(), pinnedTags: updatedPinnedTags });
      return tag;
    },

    // Unpin a tag
    unpinTag: async (tagName: string) => {
      const tag = await tagServiceClient.updateTag({
        tagName,
        pinned: false,
      });

      // Remove from pinned tags list
      const pinnedTags = get().pinnedTags.filter((t) => t.tagName !== tagName);
      set({ stateId: uniqueId(), pinnedTags });

      return tag;
    },

    // Update tag emoji (add, update, or remove)
    updateTagEmoji: async (tagName: string, emoji: string | null) => {
      const tag = await tagServiceClient.updateTag({
        tagName,
        emoji: emoji === null ? "" : emoji,
      });

      // Update both pinned tags and emoji tags lists
      const pinnedTags = get().pinnedTags.map((t) => (t.tagName === tagName ? tag : t));
      const emojiTags = get().emojiTags.map((t) => (t.tagName === tagName ? tag : t));

      // If emoji was added and tag wasn't in emoji tags list, add it
      if (emoji && !emojiTags.find((t) => t.tagName === tagName)) {
        emojiTags.push(tag);
      }
      // If emoji was removed and tag was in emoji tags list, remove it
      else if (!emoji) {
        const emojiTagsFiltered = emojiTags.filter((t) => t.tagName !== tagName);
        set({
          stateId: uniqueId(),
          pinnedTags,
          emojiTags: emojiTagsFiltered,
        });
        return tag;
      }

      set({ stateId: uniqueId(), pinnedTags, emojiTags });
      return tag;
    },
  })),
);

export const useTag = () => {
  const pinnedTags = useTagStore((state) => state.pinnedTags);
  const emojiTags = useTagStore((state) => state.emojiTags);
  const pinTag = useTagStore((state) => state.pinTag);
  const unpinTag = useTagStore((state) => state.unpinTag);
  const updateTagEmoji = useTagStore((state) => state.updateTagEmoji);
  const fetchPinnedTags = useTagStore((state) => state.fetchPinnedTags);
  const fetchEmojiTags = useTagStore((state) => state.fetchEmojiTags);

  return {
    pinnedTags,
    emojiTags,
    pinTag,
    unpinTag,
    updateTagEmoji,
    fetchPinnedTags,
    fetchEmojiTags,
  };
};
