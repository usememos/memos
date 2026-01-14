import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { aiServiceClient } from "@/connect";
import type {
  Conversation,
  CreateConversationRequest,
  GetAIConfigResponse,
  Message,
  SendMessageRequest,
  SendMessageResponse,
  UpdateConversationRequest,
} from "@/types/proto/api/v1/ai_service_pb";

// Query keys for AI-related queries
export const aiKeys = {
  all: ["ai"] as const,
  config: () => [...aiKeys.all, "config"] as const,
  conversations: () => [...aiKeys.all, "conversations"] as const,
  conversation: (id: string) => [...aiKeys.conversations(), id] as const,
  messages: (conversationId: string) => [...aiKeys.all, "messages", conversationId] as const,
};

// Get AI configuration (providers, models, enabled status)
export const useAIConfig = () => {
  return useQuery({
    queryKey: aiKeys.config(),
    queryFn: async (): Promise<GetAIConfigResponse> => {
      const response = await aiServiceClient.getAIConfig({});
      return response;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// List all conversations for current user
export const useConversations = () => {
  return useQuery({
    queryKey: aiKeys.conversations(),
    queryFn: async (): Promise<Conversation[]> => {
      const response = await aiServiceClient.listConversations({});
      return response.conversations || [];
    },
  });
};

// Get a specific conversation with messages
export const useConversation = (conversationId: string) => {
  return useQuery({
    queryKey: aiKeys.conversation(conversationId),
    queryFn: async (): Promise<Conversation> => {
      const response = await aiServiceClient.getConversation({ conversationId });
      return response;
    },
    enabled: !!conversationId,
  });
};

// Create a new conversation
export const useCreateConversation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: CreateConversationRequest): Promise<Conversation> => {
      const response = await aiServiceClient.createConversation(request);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiKeys.conversations() });
    },
  });
};

// Update conversation (title, model, provider)
export const useUpdateConversation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: UpdateConversationRequest): Promise<Conversation> => {
      const response = await aiServiceClient.updateConversation(request);
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: aiKeys.conversations() });
      queryClient.invalidateQueries({ queryKey: aiKeys.conversation(data.id) });
    },
  });
};

// Delete a conversation
export const useDeleteConversation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string): Promise<void> => {
      await aiServiceClient.deleteConversation({ conversationId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiKeys.conversations() });
    },
  });
};

// Send a message and get AI response
export const useSendMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: SendMessageRequest): Promise<SendMessageResponse> => {
      const response = await aiServiceClient.sendMessage(request);
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: aiKeys.conversation(variables.conversationId) });
      queryClient.invalidateQueries({ queryKey: aiKeys.conversations() });
    },
  });
};

// List messages in a conversation
export const useMessages = (conversationId: string) => {
  return useQuery({
    queryKey: aiKeys.messages(conversationId),
    queryFn: async (): Promise<Message[]> => {
      const response = await aiServiceClient.listMessages({ conversationId });
      return response.messages || [];
    },
    enabled: !!conversationId,
  });
};
