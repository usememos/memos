import { create } from "zustand";
import { persist } from "zustand/middleware";
import { t } from "i18next";

export interface MessageGroup {
  name: string;
  messageStorageId: string;
}

interface MessageGroupState {
  groupList: MessageGroup[];
  getState: () => MessageGroupState;
  addGroup: (group: MessageGroup) => void;
  removeGroup: (group: MessageGroup) => MessageGroup;
}

export const defaultMessageGroup: MessageGroup = {
  name: t("ask-ai.default-message-group-title"),
  messageStorageId: "message-storage",
};

export const useMessageGroupStore = create<MessageGroupState>()(
  persist(
    (set, get) => ({
      groupList: [],
      getState: () => get(),
      addGroup: (group: MessageGroup) => set((state) => ({ groupList: [...state.groupList, group] })),
      removeGroup: (group: MessageGroup) => {
        set((state) => ({
          groupList: state.groupList.filter((i) => i.name != group.name || i.messageStorageId != group.messageStorageId),
        }));
        localStorage.removeItem(group.messageStorageId);
        const groupList = get().groupList;
        return groupList.length > 0 ? groupList[groupList.length - 1] : defaultMessageGroup;
      },
    }),
    {
      name: "message-group-storage",
    }
  )
);
