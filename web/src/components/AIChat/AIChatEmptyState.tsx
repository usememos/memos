import { Bot, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AIChatEmptyStateProps {
  onNewChat: () => void;
  compact?: boolean;
  isLoading?: boolean;
}

const AIChatEmptyState = ({ onNewChat, compact = false, isLoading = false }: AIChatEmptyStateProps) => {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center gap-4 text-center",
      compact ? "p-4 py-8" : "flex-1 p-8"
    )}>
      <Bot className={cn(
        "text-muted-foreground",
        compact ? "w-10 h-10" : "w-16 h-16"
      )} />
      <div>
        <h2 className={cn(
          "font-semibold",
          compact ? "text-base" : "text-2xl"
        )}>
          AI Assistant
        </h2>
        <p className={cn(
          "text-muted-foreground mt-1",
          compact ? "text-xs max-w-[200px]" : "text-sm max-w-md"
        )}>
          {compact 
            ? "Start a chat to ask questions about your notes."
            : "Start a new conversation to chat with the AI assistant about your notes, ideas, or anything else."
          }
        </p>
      </div>
      <Button 
        onClick={onNewChat} 
        disabled={isLoading}
        size={compact ? "sm" : "default"}
      >
        <Plus className={cn(compact ? "w-3 h-3 mr-1" : "w-4 h-4 mr-2")} />
        {compact ? "New Chat" : "Start New Chat"}
      </Button>
    </div>
  );
};

export default AIChatEmptyState;
