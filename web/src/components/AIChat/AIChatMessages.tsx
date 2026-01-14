import { Bot } from "lucide-react";
import type { Message } from "@/types/proto/api/v1/ai_service_pb";
import { MessageRole } from "@/types/proto/api/v1/ai_service_pb";
import { cn } from "@/lib/utils";
import MarkdownRenderer from "@/components/MarkdownRenderer";

interface AIChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
  isSending: boolean;
  compact?: boolean;
}

const AIChatMessages = ({ messages, isLoading, isSending, compact = false }: AIChatMessagesProps) => {
  if (isLoading) {
    return (
      <div className="text-center text-muted-foreground py-8">
        Loading messages...
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        Start the conversation by typing a message below.
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", compact ? "p-3" : "max-w-3xl mx-auto p-4")}>
      {messages.map((message) => (
        <div
          key={message.id}
          className={cn(
            "flex gap-3 rounded-lg",
            compact ? "p-2" : "p-4",
            message.role === MessageRole.USER ? "bg-primary/5" : "bg-muted/50"
          )}
        >
          <div
            className={cn(
              "rounded-full flex items-center justify-center shrink-0",
              compact ? "w-6 h-6" : "w-8 h-8",
              message.role === MessageRole.USER
                ? "bg-primary text-primary-foreground"
                : "bg-muted-foreground/20"
            )}
          >
            {message.role === MessageRole.USER ? (
              <span className={compact ? "text-xs" : "text-sm"}>U</span>
            ) : (
              <Bot className={compact ? "w-3 h-3" : "w-4 h-4"} />
            )}
          </div>
          <div className="flex-1 min-w-0 overflow-hidden">
            <div className={cn(
              "prose dark:prose-invert max-w-none break-words",
              compact ? "prose-xs" : "prose-sm"
            )}>
              <MarkdownRenderer content={message.content} />
            </div>
          </div>
        </div>
      ))}
      {isSending && (
        <div className={cn(
          "flex gap-3 rounded-lg bg-muted/50",
          compact ? "p-2" : "p-4"
        )}>
          <div className={cn(
            "rounded-full flex items-center justify-center shrink-0 bg-muted-foreground/20",
            compact ? "w-6 h-6" : "w-8 h-8"
          )}>
            <Bot className={compact ? "w-3 h-3" : "w-4 h-4"} />
          </div>
          <div className="flex items-center gap-2">
            <div className="animate-pulse text-sm">Thinking...</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIChatMessages;
