import { create } from "zustand";
import { persist } from "zustand/middleware";
import { MessageGroup } from "@/store/zustand/message-group";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface MessageState {
  messageList: Message[];
  getState: () => MessageState;
  addMessage: (message: Message) => void;
  updateMessage: (id: string, appendContent: string) => void;
}

export const useMessageStore = (options: MessageGroup) => {
  return create<MessageState>()(
    persist(
      (set, get) => ({
        messageList: [] as Message[],
        getState: () => get(),
        addMessage: (message: Message) => {
          return set((state) => ({ messageList: [...state.messageList, message] }));
        },
        updateMessage: (id: string, appendContent: string) =>
          set((state) => ({
            ...state,
            messageList: state.messageList.map((item) => (item.id === id ? { ...item, content: item.content + appendContent } : item)),
          })),
      }),
      {
        name: options.messageStorageId,
      }
    )
  );
};
