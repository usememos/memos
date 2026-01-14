# Feature: Embed AI Helper Sidebar

## Overview

Add an AI helper interface to the `/memos` (Home) page as a collapsible sidebar on the right side. This feature provides quick access to AI chat functionality without leaving the memos context, while sharing the same backend, API hooks, and UI components as the existing `/ai` page.

## Goals

1. **Seamless Integration**: The AI helper should feel native to the memos experience
2. **Code Reuse**: Leverage existing AI chat infrastructure (hooks, API, styling)
3. **Unified History**: All conversations created via the sidebar should be accessible from `/ai` page
4. **Responsive Design**: Work well on desktop; gracefully degrade on mobile
5. **Non-intrusive UX**: The sidebar should not disrupt the main memos workflow

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           MainLayout.tsx                                │
│  ┌──────────────┬────────────────────────────┬───────────────────────┐  │
│  │ MemoExplorer │      Main Content          │  AIChatSidebar        │  │
│  │   (Left)     │      <Outlet />            │    (Right, Optional)  │  │
│  │              │      (Home.tsx)            │                       │  │
│  └──────────────┴────────────────────────────┴───────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                                        ↑
                                                  Floating Toggle Button
                                                  (Bottom-right corner)
```

---

## Step-by-Step Implementation Plan

### Phase 1: Create Shared AI Chat Components

**Goal**: Extract reusable components from `AIChat.tsx` for use in both the full page and sidebar.

#### Step 1.1: Create AI Chat Core Components

Create a new directory for shared AI components:

```
web/src/components/AIChat/
├── index.ts                    # Barrel exports
├── AIChatMessages.tsx          # Message list renderer
├── AIChatInput.tsx             # Input area with toolbar
├── AIChatConversationList.tsx  # Conversation sidebar list
├── AIChatEmptyState.tsx        # Empty/welcome state
└── AIChatLoadingState.tsx      # Loading spinner
```

**Files to create:**

1. **`AIChatMessages.tsx`**

   - Extract the message rendering logic from `AIChat.tsx` (lines 148-192)
   - Props: `messages: Message[]`, `isLoading: boolean`, `isSending: boolean`
   - Render user/assistant messages with `MarkdownRenderer`
   - Show "Thinking..." indicator when sending

2. **`AIChatInput.tsx`**

   - Extract the input area from `AIChat.tsx` (lines 195-275)
   - Props: `onSend: (content: string) => void`, `disabled: boolean`, `compact?: boolean`
   - Include attachment, resources, and provider selector buttons
   - Support `compact` mode for sidebar (smaller padding, hidden labels)

3. **`AIChatConversationList.tsx`**

   - Extract conversation list from `AIChat.tsx` (lines 98-131)
   - Props: `conversations`, `activeId`, `onSelect`, `onDelete`, `onNew`
   - Used in both `/ai` sidebar and potentially in embed sidebar

4. **`AIChatEmptyState.tsx`**
   - Extract empty state UI (lines 135-145)
   - Props: `onNewChat: () => void`, `compact?: boolean`

#### Step 1.2: Refactor AIChat.tsx

Refactor the existing `AIChat.tsx` page to use the new shared components:

```tsx
// web/src/pages/AIChat.tsx
import {
  AIChatMessages,
  AIChatInput,
  AIChatConversationList,
  AIChatEmptyState,
} from "@/components/AIChat";

const AIChat = () => {
  // ... existing hooks and state ...

  return (
    <div className="flex h-screen w-full">
      {/* Sidebar */}
      <div className="w-64 border-r flex flex-col">
        <AIChatConversationList
          conversations={conversations}
          activeId={conversationId}
          onSelect={(id) => navigate(`/ai/${id}`)}
          onDelete={handleDeleteConversation}
          onNew={handleNewChat}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {!conversationId ? (
          <AIChatEmptyState onNewChat={handleNewChat} />
        ) : (
          <>
            <AIChatMessages
              messages={conversation?.messages || []}
              isLoading={conversationLoading}
              isSending={sendMessage.isPending}
            />
            <AIChatInput
              onSend={handleSendMessage}
              disabled={sendMessage.isPending}
            />
          </>
        )}
      </div>
    </div>
  );
};
```

---

### Phase 2: Create AI Sidebar Context

**Goal**: Manage sidebar open/close state globally so it persists across navigation.

#### Step 2.1: Create AISidebarContext

```
web/src/contexts/AISidebarContext.tsx
```

**Implementation:**

```tsx
import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";

interface AISidebarContextType {
  isOpen: boolean;
  activeConversationId: string | null;
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
  setActiveConversation: (id: string | null) => void;
}

const AISidebarContext = createContext<AISidebarContextType | null>(null);

export const AISidebarProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);

  const openSidebar = useCallback(() => setIsOpen(true), []);
  const closeSidebar = useCallback(() => setIsOpen(false), []);
  const toggleSidebar = useCallback(() => setIsOpen((prev) => !prev), []);
  const setActiveConversation = useCallback(
    (id: string | null) => setActiveConversationId(id),
    []
  );

  return (
    <AISidebarContext.Provider
      value={{
        isOpen,
        activeConversationId,
        openSidebar,
        closeSidebar,
        toggleSidebar,
        setActiveConversation,
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
```

#### Step 2.2: Add Provider to App

Update `App.tsx` to include the `AISidebarProvider`:

```tsx
// web/src/App.tsx
import { AISidebarProvider } from "./contexts/AISidebarContext";

const App = () => {
  // ... existing code ...

  return (
    <MemoFilterProvider>
      <AISidebarProvider>
        <Outlet />
      </AISidebarProvider>
    </MemoFilterProvider>
  );
};
```

---

### Phase 3: Create AI Sidebar Component

**Goal**: Build the collapsible AI sidebar component.

#### Step 3.1: Create AIChatSidebar Component

```
web/src/components/AIChatSidebar/
├── index.tsx                   # Main sidebar component
├── AIChatSidebarToggle.tsx     # Floating toggle button
└── AIChatSidebarContent.tsx    # Sidebar content (chat interface)
```

**`AIChatSidebarToggle.tsx`** - Floating button in bottom-right corner:

```tsx
import { Bot, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAISidebar } from "@/contexts/AISidebarContext";
import { useAIConfig } from "@/hooks/useAIQueries";
import { cn } from "@/lib/utils";

const AIChatSidebarToggle = () => {
  const { isOpen, toggleSidebar } = useAISidebar();
  const { data: aiConfig } = useAIConfig();

  // Don't render if AI is not enabled
  if (!aiConfig?.enabled) return null;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={toggleSidebar}
            size="icon"
            className={cn(
              "fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full shadow-lg",
              "transition-all duration-200 hover:scale-105",
              isOpen && "bg-destructive hover:bg-destructive/90"
            )}
          >
            {isOpen ? <X className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          {isOpen ? "Close AI Assistant" : "Open AI Assistant"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default AIChatSidebarToggle;
```

**`AIChatSidebarContent.tsx`** - The sidebar chat interface:

```tsx
import { create } from "@bufbuild/protobuf";
import { useState } from "react";
import { ExternalLink, MessageSquarePlus } from "lucide-react";
import { Link } from "react-router-dom";
import {
  AIChatMessages,
  AIChatInput,
  AIChatEmptyState,
} from "@/components/AIChat";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAISidebar } from "@/contexts/AISidebarContext";
import {
  useConversation,
  useConversations,
  useCreateConversation,
  useSendMessage,
} from "@/hooks/useAIQueries";
import {
  CreateConversationRequestSchema,
  SendMessageRequestSchema,
} from "@/types/proto/api/v1/ai_service_pb";

const AIChatSidebarContent = () => {
  const { activeConversationId, setActiveConversation, closeSidebar } =
    useAISidebar();
  const [inputMessage, setInputMessage] = useState("");

  const { data: conversations = [] } = useConversations();
  const { data: conversation, isLoading: conversationLoading } =
    useConversation(activeConversationId || "");
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
            <Button variant="ghost" size="icon" className="h-6 w-6">
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
          >
            <MessageSquarePlus className="h-4 w-4" />
          </Button>
          {conversations.length > 0 && (
            <Select
              value={activeConversationId || ""}
              onValueChange={setActiveConversation}
            >
              <SelectTrigger className="h-7 w-32 text-xs">
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
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        {!activeConversationId ? (
          <AIChatEmptyState onNewChat={handleNewChat} compact />
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
          disabled={sendMessage.isPending}
          compact
        />
      </div>
    </div>
  );
};

export default AIChatSidebarContent;
```

**`index.tsx`** - Main sidebar wrapper:

```tsx
import { useAISidebar } from "@/contexts/AISidebarContext";
import { useAIConfig } from "@/hooks/useAIQueries";
import { cn } from "@/lib/utils";
import AIChatSidebarContent from "./AIChatSidebarContent";
import AIChatSidebarToggle from "./AIChatSidebarToggle";

const AIChatSidebar = () => {
  const { isOpen } = useAISidebar();
  const { data: aiConfig } = useAIConfig();

  // Don't render if AI is not enabled
  if (!aiConfig?.enabled) return <AIChatSidebarToggle />;

  return (
    <>
      {/* Toggle Button */}
      <AIChatSidebarToggle />

      {/* Sidebar Panel */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-96 bg-background border-l shadow-xl z-40",
          "transform transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <AIChatSidebarContent />
      </div>

      {/* Backdrop (optional, for mobile) */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 md:hidden"
          onClick={() => useAISidebar().closeSidebar()}
        />
      )}
    </>
  );
};

export default AIChatSidebar;
```

---

### Phase 4: Integrate Sidebar into MainLayout

**Goal**: Add the AI sidebar to the main layout so it appears on memos pages.

#### Step 4.1: Update MainLayout.tsx

```tsx
// web/src/layouts/MainLayout.tsx
import AIChatSidebar from "@/components/AIChatSidebar";
import { useAISidebar } from "@/contexts/AISidebarContext";

const MainLayout = () => {
  const { isOpen } = useAISidebar();
  // ... existing code ...

  return (
    <section className="@container w-full min-h-full flex flex-col justify-start items-center">
      {/* ... existing mobile header and MemoExplorer ... */}

      <div
        className={cn(
          "w-full min-h-full transition-all duration-300",
          lg ? "pl-72" : md ? "pl-56" : "",
          // Adjust padding when sidebar is open
          isOpen && md ? "pr-96" : ""
        )}
      >
        <div className={cn("w-full mx-auto px-4 sm:px-6 md:pt-6 pb-8")}>
          <Outlet />
        </div>
      </div>

      {/* AI Chat Sidebar */}
      <AIChatSidebar />
    </section>
  );
};
```

---

### Phase 5: Responsive Design & Polish

#### Step 5.1: Mobile Considerations

- On mobile (`< md` breakpoint), the sidebar should be full-width overlay
- The toggle button should be visible but smaller on mobile
- Consider hiding the toggle on very small screens or showing a bottom sheet instead

#### Step 5.2: Keyboard Shortcuts

Add keyboard shortcut to toggle sidebar:

```tsx
// In MainLayout.tsx or a dedicated hook
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Cmd/Ctrl + Shift + A to toggle AI sidebar
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "a") {
      e.preventDefault();
      toggleSidebar();
    }
  };

  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [toggleSidebar]);
```

#### Step 5.3: Animation & Transitions

- Smooth slide-in/slide-out animation for sidebar
- Fade transition for backdrop
- Scale animation for toggle button on hover

#### Step 5.4: Accessibility

- Add `aria-label` to toggle button
- Add `aria-expanded` state
- Ensure focus management when opening/closing
- Add `role="complementary"` to sidebar

---

### Phase 6: Testing & Validation

#### Step 6.1: Manual Testing Checklist

- [ ] Toggle button appears on Home page (`/memos`)
- [ ] Toggle button hidden when AI is disabled
- [ ] Sidebar opens/closes smoothly
- [ ] Can create new conversation from sidebar
- [ ] Can send messages and receive responses
- [ ] Can switch between conversations
- [ ] Conversation history visible in `/ai` page
- [ ] Link to `/ai` works correctly
- [ ] Responsive on mobile devices
- [ ] Keyboard shortcut works (Cmd+Shift+A)
- [ ] No layout shift when sidebar opens

#### Step 6.2: TypeScript Validation

```bash
cd web && pnpm lint
```

#### Step 6.3: Build Validation

```bash
cd web && pnpm build
```

---

## File Changes Summary

### New Files

| File                                                        | Purpose                               |
| ----------------------------------------------------------- | ------------------------------------- |
| `web/src/components/AIChat/index.ts`                        | Barrel exports for AI chat components |
| `web/src/components/AIChat/AIChatMessages.tsx`              | Message list renderer                 |
| `web/src/components/AIChat/AIChatInput.tsx`                 | Chat input with toolbar               |
| `web/src/components/AIChat/AIChatEmptyState.tsx`            | Empty state UI                        |
| `web/src/components/AIChat/AIChatLoadingState.tsx`          | Loading state UI                      |
| `web/src/components/AIChatSidebar/index.tsx`                | Main sidebar component                |
| `web/src/components/AIChatSidebar/AIChatSidebarToggle.tsx`  | Floating toggle button                |
| `web/src/components/AIChatSidebar/AIChatSidebarContent.tsx` | Sidebar chat content                  |
| `web/src/contexts/AISidebarContext.tsx`                     | Sidebar state management              |

### Modified Files

| File                             | Changes                                              |
| -------------------------------- | ---------------------------------------------------- |
| `web/src/App.tsx`                | Add `AISidebarProvider`                              |
| `web/src/layouts/MainLayout.tsx` | Add `AIChatSidebar` component, adjust layout padding |
| `web/src/pages/AIChat.tsx`       | Refactor to use shared components                    |

---

## Design Decisions

### 1. Why Extract Shared Components?

- **DRY Principle**: Avoid duplicating message rendering, input handling logic
- **Consistency**: Ensure identical styling and behavior in both contexts
- **Maintainability**: Single source of truth for AI chat UI

### 2. Why Use Context for Sidebar State?

- **Persistence**: Sidebar state persists across page navigation
- **Accessibility**: Any component can access/control sidebar
- **Clean Props**: Avoids prop drilling through layout hierarchy

### 3. Why Fixed Positioning for Toggle Button?

- **Always Accessible**: Visible regardless of scroll position
- **Standard UX Pattern**: Similar to chat widgets (Intercom, Zendesk)
- **Non-intrusive**: Doesn't affect main content layout

### 4. Why 96rem (384px) Sidebar Width?

- **Comfortable Chat Width**: Enough space for message content
- **Balanced Layout**: Doesn't overwhelm main content on standard screens
- **Responsive**: Full-width on mobile

---

## Future Enhancements

1. **Context-Aware AI**: Pass current memo content to AI for context
2. **Quick Actions**: "Summarize this memo", "Find related memos"
3. **Memo References**: Allow AI to reference and link to user's memos
4. **Streaming Responses**: Real-time token streaming for faster feedback
5. **Voice Input**: Speech-to-text for hands-free interaction
6. **Pinned Conversations**: Pin frequently used conversations
7. **Conversation Search**: Search through conversation history

---

## Dependencies

No new dependencies required. Uses existing:

- `@tanstack/react-query` - Data fetching
- `lucide-react` - Icons
- `@/components/ui/*` - shadcn/ui components
- `tailwindcss` - Styling

---

## Estimated Effort

| Phase                        | Effort         |
| ---------------------------- | -------------- |
| Phase 1: Shared Components   | 2-3 hours      |
| Phase 2: Sidebar Context     | 30 min         |
| Phase 3: Sidebar Component   | 2-3 hours      |
| Phase 4: Layout Integration  | 1 hour         |
| Phase 5: Polish & Responsive | 1-2 hours      |
| Phase 6: Testing             | 1 hour         |
| **Total**                    | **7-10 hours** |
