import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAISidebar } from "@/contexts/AISidebarContext";
import { useAIConfig } from "@/hooks/useAIQueries";
import { cn } from "@/lib/utils";

const AIChatSidebarToggle = () => {
  const { isOpen, toggleSidebar } = useAISidebar();
  const { data: aiConfig } = useAIConfig();

  // Don't render if AI is not enabled or sidebar is open
  if (!aiConfig?.enabled || isOpen) return null;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={toggleSidebar}
            size="icon"
            aria-label="Open AI Assistant"
            className={cn(
              "fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full shadow-lg",
              "transition-all duration-200 hover:scale-105"
            )}
          >
            <Bot className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          Open AI Assistant (⌘⇧A)
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default AIChatSidebarToggle;
