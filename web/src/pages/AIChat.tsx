import { create } from "@bufbuild/protobuf";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Bot, MessageSquare, Plus, Send, Trash2 } from "lucide-react";
import { useAIConfig, useConversation, useConversations, useCreateConversation, useDeleteConversation, useSendMessage } from "@/hooks/useAIQueries";
import { CreateConversationRequestSchema, MessageRole, SendMessageRequestSchema } from "@/types/proto/api/v1/ai_service_pb";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import MarkdownRenderer from "@/components/MarkdownRenderer";

const AIChat = () => {
  const navigate = useNavigate();
  const { conversationId } = useParams<{ conversationId: string }>();
  const [inputMessage, setInputMessage] = useState("");

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

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !conversationId) return;

    const message = inputMessage;
    setInputMessage("");

    try {
      await sendMessage.mutateAsync(create(SendMessageRequestSchema, {
        conversationId,
        content: message,
      }));
    } catch (error) {
      console.error("Failed to send message:", error);
      setInputMessage(message); // Restore message on error
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (configLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!aiConfig?.enabled) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <Bot className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-2xl font-semibold">AI Chat Not Available</h2>
        <p className="text-muted-foreground max-w-md">
          AI features are not enabled. Please configure an AI provider (OpenAI or DeepSeek) to use this feature.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Sidebar - Conversation List */}
      <div className="w-64 border-r flex flex-col bg-muted/30">
        <div className="p-4 border-b">
          <Button onClick={handleNewChat} className="w-full" disabled={createConversation.isPending}>
            <Plus className="w-4 h-4 mr-2" />
            New Chat
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {conversationsLoading ? (
              <div className="text-center text-muted-foreground py-4">Loading...</div>
            ) : conversations.length === 0 ? (
              <div className="text-center text-muted-foreground py-4 text-sm">No conversations yet</div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-muted group",
                    conversationId === conv.id && "bg-muted"
                  )}
                  onClick={() => navigate(`/ai/${conv.id}`)}
                >
                  <MessageSquare className="w-4 h-4 shrink-0" />
                  <span className="flex-1 truncate text-sm">{conv.title || "New Chat"}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteConversation(conv.id);
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {!conversationId ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <Bot className="w-16 h-16 text-muted-foreground" />
            <h2 className="text-2xl font-semibold">AI Assistant</h2>
            <p className="text-muted-foreground max-w-md">
              Start a new conversation to chat with the AI assistant about your notes, ideas, or anything else.
            </p>
            <Button onClick={handleNewChat} disabled={createConversation.isPending}>
              <Plus className="w-4 h-4 mr-2" />
              Start New Chat
            </Button>
          </div>
        ) : (
          <>
            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="max-w-3xl mx-auto space-y-4">
                {conversationLoading ? (
                  <div className="text-center text-muted-foreground py-8">Loading messages...</div>
                ) : conversation?.messages?.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    Start the conversation by typing a message below.
                  </div>
                ) : (
                  conversation?.messages?.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex gap-3 p-4 rounded-lg",
                        message.role === MessageRole.USER ? "bg-primary/5" : "bg-muted/50"
                      )}
                    >
                      <div
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                          message.role === MessageRole.USER ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20"
                        )}
                      >
                        {message.role === MessageRole.USER ? "U" : <Bot className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <MarkdownRenderer content={message.content} />
                        </div>
                      </div>
                    </div>
                  ))
                )}
                {sendMessage.isPending && (
                  <div className="flex gap-3 p-4 rounded-lg bg-muted/50">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-muted-foreground/20">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="animate-pulse">Thinking...</div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="border-t p-4">
              <div className="max-w-3xl mx-auto flex gap-2">
                <Textarea
                  placeholder="Type your message..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="min-h-[60px] max-h-[200px] resize-none"
                  disabled={sendMessage.isPending}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || sendMessage.isPending}
                  className="shrink-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <div className="max-w-3xl mx-auto mt-2 text-xs text-muted-foreground text-center">
                Using {aiConfig.defaultProvider} / {aiConfig.defaultModel}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AIChat;
