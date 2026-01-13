import { create } from "@bufbuild/protobuf";
import { useNavigate, useParams } from "react-router-dom";
import { Bot } from "lucide-react";
import { AIChatMessages, AIChatInput, AIChatEmptyState, AIChatConversationList } from "@/components/AIChat";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAIConfig, useConversation, useConversations, useCreateConversation, useDeleteConversation, useSendMessage } from "@/hooks/useAIQueries";
import { CreateConversationRequestSchema, SendMessageRequestSchema } from "@/types/proto/api/v1/ai_service_pb";

const AIChat = () => {
  const navigate = useNavigate();
  const { conversationId } = useParams<{ conversationId: string }>();

  const { data: aiConfig, isLoading: configLoading } = useAIConfig();
  const { data: conversations = [], isLoading: conversationsLoading } = useConversations();
  const { data: conversation, isLoading: conversationLoading } = useConversation(conversationId || "");
  const createConversation = useCreateConversation();
  const deleteConversation = useDeleteConversation();
  const sendMessage = useSendMessage();

  const handleNewChat = async () => {
    try {
      const newConversation = await createConversation.mutateAsync(create(CreateConversationRequestSchema, {}));
      navigate(`/ai/${newConversation.id}`);
    } catch (error) {
      console.error("Failed to create conversation:", error);
    }
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await deleteConversation.mutateAsync(id);
      if (conversationId === id) {
        navigate("/ai");
      }
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || !conversationId) return;

    try {
      await sendMessage.mutateAsync(create(SendMessageRequestSchema, {
        conversationId,
        content,
      }));
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  if (configLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)] sm:h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!aiConfig?.enabled) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] sm:h-screen gap-4 p-8 text-center">
        <Bot className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-2xl font-semibold">AI Chat Not Available</h2>
        <p className="text-muted-foreground max-w-md">
          AI features are not enabled. Please configure an AI provider (OpenAI or DeepSeek) to use this feature.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] sm:h-screen w-full">
      {/* Sidebar - Conversation List */}
      <div className="w-64 border-r flex flex-col shrink-0">
        <AIChatConversationList
          conversations={conversations}
          activeId={conversationId}
          onSelect={(id: string) => navigate(`/ai/${id}`)}
          onDelete={handleDeleteConversation}
          onNew={handleNewChat}
          isLoading={conversationsLoading}
          isCreating={createConversation.isPending}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!conversationId ? (
          <AIChatEmptyState 
            onNewChat={handleNewChat} 
            isLoading={createConversation.isPending}
          />
        ) : (
          <>
            {/* Messages */}
            <ScrollArea className="flex-1 overflow-hidden">
              <AIChatMessages
                messages={conversation?.messages || []}
                isLoading={conversationLoading}
                isSending={sendMessage.isPending}
              />
            </ScrollArea>

            {/* Input Area */}
            <AIChatInput
              onSend={handleSendMessage}
              disabled={sendMessage.isPending}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default AIChat;
