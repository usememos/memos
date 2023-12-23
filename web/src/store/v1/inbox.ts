import { create } from "zustand";
import { combine } from "zustand/middleware";
import { inboxServiceClient } from "@/grpcweb";
import { Inbox } from "@/types/proto/api/v2/inbox_service";

interface State {
  inboxes: Inbox[];
}

const getDefaultState = (): State => ({
  inboxes: [],
});

export const useInboxStore = create(
  combine(getDefaultState(), (set, get) => ({
    fetchInboxes: async () => {
      const { inboxes } = await inboxServiceClient.listInboxes({});
      set({ inboxes });
      return inboxes;
    },
    updateInbox: async (inbox: Partial<Inbox>, updateMask: string[]) => {
      const { inbox: updatedInbox } = await inboxServiceClient.updateInbox({
        inbox,
        updateMask,
      });
      if (!updatedInbox) {
        throw new Error("Inbox not found");
      }
      const inboxes = get().inboxes;
      set({ inboxes: inboxes.map((i) => (i.name === updatedInbox.name ? updatedInbox : i)) });
      return updatedInbox;
    },
  }))
);
