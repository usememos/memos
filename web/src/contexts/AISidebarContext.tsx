import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

const MIN_WIDTH = 320;
const MAX_WIDTH_RATIO = 1 / 3; // Maximum 1/3 of screen width
const DEFAULT_WIDTH = 384; // 24rem = 384px

interface AISidebarContextType {
  isOpen: boolean;
  activeConversationId: string | null;
  width: number;
  minWidth: number;
  maxWidth: number;
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
  setActiveConversation: (id: string | null) => void;
  setWidth: (width: number) => void;
}

const AISidebarContext = createContext<AISidebarContextType | null>(null);

export const AISidebarProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [width, setWidthState] = useState(DEFAULT_WIDTH);

  const openSidebar = useCallback(() => setIsOpen(true), []);
  const closeSidebar = useCallback(() => setIsOpen(false), []);
  const toggleSidebar = useCallback(() => setIsOpen((prev) => !prev), []);
  const setActiveConversation = useCallback((id: string | null) => setActiveConversationId(id), []);
  
  // Calculate max width as 1/3 of screen width
  const maxWidth = typeof window !== "undefined" ? Math.floor(window.innerWidth * MAX_WIDTH_RATIO) : 600;
  
  const setWidth = useCallback((newWidth: number) => {
    const clampedWidth = Math.min(Math.max(newWidth, MIN_WIDTH), maxWidth);
    setWidthState(clampedWidth);
  }, [maxWidth]);

  return (
    <AISidebarContext.Provider
      value={{
        isOpen,
        activeConversationId,
        width,
        minWidth: MIN_WIDTH,
        maxWidth,
        openSidebar,
        closeSidebar,
        toggleSidebar,
        setActiveConversation,
        setWidth,
      }}
    >
      {children}
    </AISidebarContext.Provider>
  );
};

export const useAISidebar = () => {
  const context = useContext(AISidebarContext);
  if (!context) {
    throw new Error("useAISidebar must be used within AISidebarProvider");
  }
  return context;
};
