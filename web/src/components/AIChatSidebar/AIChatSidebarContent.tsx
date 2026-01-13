import { create } from "@bufbuild/protobuf";
import { ExternalLink, MessageSquarePlus, Minus } from "lucide-react";
import { Link } from "react-router-dom";
import { AIChatMessages, AIChatInput, AIChatEmptyState } from "@/components/AIChat";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAISidebar } from "@/contexts/AISidebarContext";
import { useConversation, useConversations, useCreateConversation, useSendMessage } from "@/hooks/useAIQueries";
import { CreateConversationRequestSchema, SendMessageRequestSchema } from "@/types/proto/api/v1/ai_service_pb";

const AIChatSidebarContent = () => {
  const { activeConversationId, setActiveConversation, closeSidebar } = useAISidebar();

  const { data: conversations = [] } = useConversations();
  const { data: conversation, isLoading: conversationLoading } = useConversation(activeConversationId || "");
  const createConversation = useCreateConversation();
  const sendMessage = useSendMessage();

  const handleNewChat = async () => {
    try {
      const newConversation = await createConversation.mutateAsync(
        create(CreateConversationRequestSchema, {})
      );
      setActiveConversation(newConversation.id);
    } catch (error) {
      console.error("Failed to create conversation:", error);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return;

    // Create conversation if none selected
    let conversationId = activeConversationId;
    if (!conversationId) {
      try {
        const newConversation = await createConversation.mutateAsync(
          create(CreateConversationRequestSchema, {})
        );
        conversationId = newConversation.id;
        setActiveConversation(conversationId);
      } catch (error) {
        console.error("Failed to create conversation:", error);
        return;
      }
    }

    try {
      await sendMessage.mutateAsync(
        create(SendMessageRequestSchema, {
          conversationId,
          content,
        })
      );
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">AI Assistant</h3>
          <Link to="/ai" onClick={closeSidebar}>
            <Button variant="ghost" size="icon" className="h-6 w-6" title="Open full AI page">
              <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleNewChat}
            disabled={createConversation.isPending}
            title="New chat"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </Button>
          {conversations.length > 0 && (
            <Select
              value={activeConversationId || ""}
              onValueChange={setActiveConversation}
            >
              <SelectTrigger className="h-7 w-28 text-xs">
                <SelectValue placeholder="Select chat" />
              </SelectTrigger>
              <SelectContent>
                {conversations.slice(0, 10).map((conv) => (
                  <SelectItem key={conv.id} value={conv.id} className="text-xs">
                    {conv.title || "New Chat"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {/* Minimize button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={closeSidebar}
            title="Minimize"
          >
            <Minus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        {!activeConversationId ? (
          <AIChatEmptyState 
            onNewChat={handleNewChat} 
            compact 
            isLoading={createConversation.isPending}
          />
        ) : (
          <AIChatMessages
            messages={conversation?.messages || []}
            isLoading={conversationLoading}
            isSending={sendMessage.isPending}
            compact
          />
        )}
      </ScrollArea>

      {/* Input */}
      <div className="shrink-0 border-t">
        <AIChatInput
          onSend={handleSendMessage}
          disabled={sendMessage.isPending || createConversation.isPending}
          compact
        />
      </div>
    </div>
  );
};

export default AIChatSidebarContent;
