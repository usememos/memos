import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface MessageGroup {
  name: string;
  messageStorageId: string;
}

interface MessageGroupState {
  groupList: MessageGroup[];
  getState: () => MessageGroupState;
  addGroup: (group: MessageGroup) => void;
}

export const useMessageGroupStore = create<MessageGroupState>()(
  persist(
    (set, get) => ({
      groupList: [],
      getState: () => get(),
      addGroup: (group: MessageGroup) => set((state) => ({ groupList: [...state.groupList, group] })),
    }),
    {
      name: "message-group-storage",
    }
  )
);
