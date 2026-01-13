import { MessageSquare, Plus, Trash2 } from "lucide-react";
import type { Conversation } from "@/types/proto/api/v1/ai_service_pb";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface AIChatConversationListProps {
  conversations: Conversation[];
  activeId?: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  isLoading?: boolean;
  isCreating?: boolean;
}

const AIChatConversationList = ({
  conversations,
  activeId,
  onSelect,
  onDelete,
  onNew,
  isLoading = false,
  isCreating = false,
}: AIChatConversationListProps) => {
  return (
    <div className="flex flex-col h-full bg-muted/30">
      <div className="p-4 border-b">
        <Button onClick={onNew} className="w-full" disabled={isCreating}>
          <Plus className="w-4 h-4 mr-2" />
          New Chat
        </Button>
      </div>
      <ScrollArea className="flex-1 overflow-hidden">
        <div className="p-2 space-y-1">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-4">Loading...</div>
          ) : conversations.length === 0 ? (
            <div className="text-center text-muted-foreground py-4 text-sm">No conversations yet</div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-muted group",
                  activeId === conv.id && "bg-muted"
                )}
                onClick={() => onSelect(conv.id)}
              >
                <MessageSquare className="w-4 h-4 shrink-0" />
                <span className="flex-1 truncate text-sm">{conv.title || "New Chat"}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(conv.id);
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
  );
};

export default AIChatConversationList;
