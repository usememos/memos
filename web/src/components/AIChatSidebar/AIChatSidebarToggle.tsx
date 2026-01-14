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
          <button
            onClick={toggleSidebar}
            aria-label="Open AI Assistant"
            className={cn(
              "fixed top-6 right-6 z-50",
              "h-12 w-12 rounded-[18px]", // Apple-style squircle
              "bg-white/90 dark:bg-zinc-800/90 backdrop-blur-md", // Frosted glass effect
              "border border-zinc-200/50 dark:border-zinc-700/50",
              "shadow-xl shadow-zinc-200/50 dark:shadow-black/50", // Soft, elegant shadow
              "flex items-center justify-center",
              "text-zinc-600 dark:text-zinc-300",
              "transition-all duration-300 cubic-bezier(0.2, 0.8, 0.2, 1)", // Smooth easeOut
              "hover:scale-105 hover:shadow-2xl hover:bg-white dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100",
              "active:scale-95",
              "group outline-none"
            )}
          >
            {/* Friendly AI Assistant Mascot (Bot with Sprout) */}
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3"
            >
              {/* Head */}
              <rect x="4" y="7" width="16" height="13" rx="5" ry="5" />
              
              {/* Eyes - making them look attentive */}
              <circle cx="9" cy="12" r="1.5" fill="currentColor" stroke="none" className="opacity-75" />
              <circle cx="15" cy="12" r="1.5" fill="currentColor" stroke="none" className="opacity-75" />
              
              {/* Subtle Smile */}
              <path d="M10 15.5c.5.5 2.5.5 3 0" />

              {/* Sprouting Leaf (Knowledge Theme) */}
              <path d="M12 7V3.5" />
              <path d="M12 3.5c0 0 2.5-1 2.5 1.5S12 7 12 7" />
            </svg>
          </button>
        </TooltipTrigger>
        <TooltipContent 
          side="left" 
          className="bg-white/90 dark:bg-zinc-800/90 backdrop-blur text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700 shadow-lg px-3 py-1.5 text-xs font-medium rounded-lg"
        >
          <div className="flex items-center gap-2">
            <span>AI Assistant</span>
            <kbd className="px-1 py-0.5 text-[0.6rem] bg-zinc-100 dark:bg-zinc-700/50 border border-zinc-200 dark:border-zinc-600 rounded font-sans text-zinc-500">⌘⇧A</kbd>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default AIChatSidebarToggle;
