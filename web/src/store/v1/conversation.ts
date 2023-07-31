import { t } from "i18next";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Conversation {
  name: string;
  messageStorageId: string;
}

interface ConversationState {
  conversationList: Conversation[];
  getState: () => ConversationState;
  addConversation: (conversation: Conversation) => void;
  removeConversation: (conversation: Conversation) => Conversation;
}

export const defaultConversation: Conversation = {
  name: t("ask-ai.default-message-conversation-title"),
  messageStorageId: "message-storage",
};

export const useConversationStore = create<ConversationState>()(
  persist(
    (set, get) => ({
      conversationList: [],
      getState: () => get(),
      addConversation: (conversation: Conversation) => set((state) => ({ conversationList: [...state.conversationList, conversation] })),
      removeConversation: (conversation: Conversation) => {
        set((state) => ({
          conversationList: state.conversationList.filter(
            (i) => i.name != conversation.name || i.messageStorageId != conversation.messageStorageId
          ),
        }));
        localStorage.removeItem(conversation.messageStorageId);
        const conversationList = get().conversationList;
        return conversationList.length > 0 ? conversationList[conversationList.length - 1] : defaultConversation;
      },
    }),
    {
      name: "message-conversation-storage",
    }
  )
);
