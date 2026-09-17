import { useCallback, useState } from "react";
import { toast } from "react-hot-toast";
import { aiServiceClient } from "@/connect";
import { handleError } from "@/lib/error";
import { ChatMessageRole, type ChatProposal } from "@/types/proto/api/v1/ai_service_pb";

export type HubProposal = ChatProposal & { clientId: string };

/** One turn as the Hub holds it. The server keeps no conversation state. */
export interface HubMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Note changes the model proposed with this reply. Never applied here. */
  proposals: HubProposal[];
  /** Context receipt: how many notes this reply actually read. */
  contextMemoCount: number;
  contextEstimatedTokens: number;
  /** True when the provider stopped because the reply hit the token limit. */
  truncated: boolean;
}

export interface SendChatTurnOptions {
  filter: string;
}

const createMessageId = (): string => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

/** Removes exactly one proposal without relying on its mutable array position. */
export const retireProposal = (messages: HubMessage[], messageId: string, proposalId: string): HubMessage[] =>
  messages.map((message) =>
    message.id === messageId
      ? { ...message, proposals: message.proposals.filter((proposal) => proposal.clientId !== proposalId) }
      : message,
  );

/**
 * Owns the Hub conversation and drives the Chat RPC. The whole transcript is
 * resent every turn, which is what keeps the server stateless.
 */
export const useAiChat = () => {
  const [messages, setMessages] = useState<HubMessage[]>([]);
  const [isSending, setIsSending] = useState(false);

  const reset = useCallback(() => {
    setMessages([]);
  }, []);

  /** Retires a proposal after the user acts on it. */
  const resolveProposal = useCallback((messageId: string, proposalId: string) => {
    setMessages((previous) => retireProposal(previous, messageId, proposalId));
  }, []);

  const send = useCallback(
    async (content: string, options: SendChatTurnOptions): Promise<boolean> => {
      const trimmed = content.trim();
      if (trimmed === "" || isSending) return false;

      const userMessage: HubMessage = {
        id: createMessageId(),
        role: "user",
        content: trimmed,
        proposals: [],
        contextMemoCount: 0,
        contextEstimatedTokens: 0,
        truncated: false,
      };

      // Snapshot the transcript before adding the new turn so the request body
      // carries the conversation up to and including the new user message.
      const transcript = [...messages, userMessage];
      setMessages(transcript);
      setIsSending(true);

      try {
        const response = await aiServiceClient.chat({
          filter: options.filter,
          messages: transcript.map((message) => ({
            role: message.role === "user" ? ChatMessageRole.USER : ChatMessageRole.ASSISTANT,
            content: message.content,
          })),
        });

        setMessages((previous) => [
          ...previous,
          {
            id: createMessageId(),
            role: "assistant",
            content: response.content,
            proposals: response.proposals.map((proposal) => ({ ...proposal, clientId: createMessageId() })),
            contextMemoCount: Number(response.contextMemoCount),
            contextEstimatedTokens: Number(response.contextEstimatedTokens),
            truncated: response.truncated,
          },
        ]);
        return true;
      } catch (error: unknown) {
        // The user's message stays in the thread so the draft is never lost;
        // the error is reported alongside it.
        await handleError(error, toast.error, { context: "AI chat" });
        return false;
      } finally {
        setIsSending(false);
      }
    },
    [isSending, messages],
  );

  return { messages, isSending, send, reset, resolveProposal };
};
