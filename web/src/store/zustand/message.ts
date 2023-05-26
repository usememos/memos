import { create } from "zustand";
import { persist } from "zustand/middleware";
import { MessageGroup } from "@/store/zustand/message-group";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

interface MessageState {
  messageList: Message[];
  getState: () => MessageState;
  addMessage: (message: Message) => void;
}

export const useMessageStore = (options: MessageGroup) => {
  return create<MessageState>()(
    persist(
      (set, get) => ({
        messageList: [],
        getState: () => get(),
        addMessage: (message: Message) => set((state) => ({ messageList: [...state.messageList, message] })),
      }),
      {
        name: options.messageStorageId,
      }
    )
  );
};
