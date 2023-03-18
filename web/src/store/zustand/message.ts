import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

interface MessageState {
  messageList: Message[];
  getState: () => MessageState;
  addMessage: (message: Message) => void;
}

export const useMessageStore = create<MessageState>()(
  persist(
    (set, get) => ({
      messageList: [],
      getState: () => get(),
      addMessage: (message: Message) => set((state) => ({ messageList: [...state.messageList, message] })),
    }),
    {
      name: "message-storage",
    }
  )
);
