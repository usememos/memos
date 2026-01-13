import { useEffect, useCallback, useState } from "react";
import { GripVertical } from "lucide-react";
import { useAISidebar } from "@/contexts/AISidebarContext";
import { useAIConfig } from "@/hooks/useAIQueries";
import useMediaQuery from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import AIChatSidebarContent from "./AIChatSidebarContent";
import AIChatSidebarToggle from "./AIChatSidebarToggle";

const AIChatSidebar = () => {
  const { isOpen, closeSidebar, toggleSidebar, width, setWidth, minWidth, maxWidth } = useAISidebar();
  const { data: aiConfig } = useAIConfig();
  const md = useMediaQuery("md");
  const [isResizing, setIsResizing] = useState(false);

  // Keyboard shortcut: Cmd/Ctrl + Shift + A
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        toggleSidebar();
      }
      // Close on Escape
      if (e.key === "Escape" && isOpen) {
        closeSidebar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar, closeSidebar, isOpen]);

  // Handle resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      const newWidth = window.innerWidth - e.clientX;
      setWidth(newWidth); // Context will clamp to min/max
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    // Add cursor style to body during resize
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, setWidth]);

  // Don't render anything if AI is not enabled
  if (!aiConfig?.enabled) return null;

  return (
    <>
      {/* Toggle Button */}
      <AIChatSidebarToggle />

      {/* Sidebar Panel */}
      <aside
        role="complementary"
        aria-label="AI Assistant"
        style={{ width: md ? `${width}px` : "100%" }}
        className={cn(
          "fixed top-0 right-0 h-full bg-background border-l shadow-xl z-40",
          "transform transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full",
          isResizing && "transition-none select-none"
        )}
      >
        {/* Resize Handle - wider hit area for easier grabbing */}
        {md && isOpen && (
          <div
            className={cn(
              "absolute left-0 top-0 h-full w-3 cursor-ew-resize z-50",
              "flex items-center justify-center",
              "hover:bg-primary/10 active:bg-primary/20",
              "group transition-colors",
              isResizing && "bg-primary/20"
            )}
            onMouseDown={handleMouseDown}
          >
            {/* Visual grip indicator */}
            <div className={cn(
              "h-8 w-1 rounded-full bg-muted-foreground/30",
              "group-hover:bg-primary/50 group-active:bg-primary",
              "transition-colors",
              isResizing && "bg-primary"
            )}>
              <GripVertical className="h-8 w-3 -ml-1 text-muted-foreground/50 group-hover:text-primary/70" />
            </div>
          </div>
        )}
        <div className="h-full pl-3">
          <AIChatSidebarContent />
        </div>
      </aside>

      {/* Backdrop for mobile */}
      {isOpen && !md && (
        <div
          className="fixed inset-0 bg-black/20 z-30 transition-opacity duration-300"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}
    </>
  );
};

export default AIChatSidebar;
