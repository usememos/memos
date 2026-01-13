import { useState } from "react";
import { ArrowUp, Bot, ChevronDown, FileText, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useAIConfig } from "@/hooks/useAIQueries";

interface AIChatInputProps {
  onSend: (content: string) => void;
  disabled: boolean;
  compact?: boolean;
}

const AIChatInput = ({ onSend, disabled, compact = false }: AIChatInputProps) => {
  const [inputMessage, setInputMessage] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const { data: aiConfig } = useAIConfig();

  const activeProvider = selectedProvider || aiConfig?.defaultProvider || "openai";
  const activeModel = aiConfig?.defaultModel || "gpt-4";

  const availableProviders = aiConfig?.providers || [
    { name: "openai", displayName: "OpenAI", models: ["gpt-4", "gpt-3.5-turbo"] },
    { name: "deepseek", displayName: "DeepSeek", models: ["deepseek-chat", "deepseek-coder"] },
  ];

  const handleSend = () => {
    if (!inputMessage.trim()) return;
    onSend(inputMessage);
    setInputMessage("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={cn(compact ? "p-2" : "p-4", "shrink-0")}>
      <div className={cn(compact ? "" : "max-w-3xl mx-auto")}>
        <div className="relative border rounded-xl bg-background shadow-sm">
          <Textarea
            placeholder="Type your message..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            className={cn(
              "resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-xl",
              compact 
                ? "min-h-[60px] max-h-[120px] pr-10 pb-10 text-sm" 
                : "min-h-[100px] max-h-[200px] pr-14 pb-14"
            )}
            disabled={disabled}
          />
          
          {/* Bottom toolbar */}
          <div className={cn(
            "absolute left-2 right-2 flex items-center justify-between",
            compact ? "bottom-1" : "bottom-2"
          )}>
            {/* Left side options */}
            <div className="flex items-center gap-1">
              <TooltipProvider delayDuration={300}>
                {!compact && (
                  <>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-lg hover:bg-muted"
                          disabled={disabled}
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Add attachment</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-lg hover:bg-muted"
                          disabled={disabled}
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Add resources</TooltipContent>
                    </Tooltip>
                  </>
                )}

                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "rounded-lg hover:bg-muted gap-1",
                            compact ? "h-6 px-1.5 text-xs" : "h-7 px-2 text-xs"
                          )}
                          disabled={disabled}
                        >
                          <Bot className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} />
                          <span className="hidden sm:inline">{activeProvider}</span>
                          <ChevronDown className="w-3 h-3" />
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Select LLM provider</TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent align="start">
                    {availableProviders.map((provider) => (
                      <DropdownMenuItem
                        key={provider.name}
                        onClick={() => setSelectedProvider(provider.name)}
                        className={cn(activeProvider === provider.name && "bg-muted")}
                      >
                        {provider.displayName}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TooltipProvider>
            </div>

            {/* Send button */}
            <Button
              onClick={handleSend}
              disabled={!inputMessage.trim() || disabled}
              size="icon"
              className={cn("rounded-lg", compact ? "h-6 w-6" : "h-7 w-7")}
            >
              <ArrowUp className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} />
            </Button>
          </div>
        </div>
        
        {!compact && (
          <div className="mt-2 text-xs text-muted-foreground text-center">
            Using {activeProvider} / {activeModel}
          </div>
        )}
      </div>
    </div>
  );
};

export default AIChatInput;
