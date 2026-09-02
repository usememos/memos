import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import type { MemoOriginScope } from "@/components/MemoView/navigation";
import type { PrimaryMemoScope } from "@/lib/memo-views";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";

export type AttachmentSection = "all" | "media" | "audio" | "documents" | "unused";
export type InboxFilter = "all" | "unread" | "archived";

export interface MemoDetailSidebarDescriptor {
  memo: Memo;
  parentMemo?: Memo;
  from?: string;
  fromScope?: MemoOriginScope;
  hasExplicitOrigin?: boolean;
  commentCount?: number;
  readonly?: boolean;
  onEdit?: () => void;
  onCommentsOpen?: () => void;
  onCommentCreate?: () => void;
  onShareImageOpen?: () => void;
}

interface AppSidebarContextValue {
  attachmentSection: AttachmentSection;
  setAttachmentSection: (section: AttachmentSection) => void;
  inboxFilter: InboxFilter;
  setInboxFilter: (filter: InboxFilter) => void;
  memoDetail: MemoDetailSidebarDescriptor | undefined;
  setMemoDetail: (descriptor?: MemoDetailSidebarDescriptor) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  closeMobileThen: (action: () => void) => void;
  completeMobileClose: (open: boolean) => void;
  quickFindOpen: boolean;
  setQuickFindOpen: (open: boolean) => void;
  memoScope: PrimaryMemoScope;
  setMemoScope: (scope: PrimaryMemoScope) => void;
}

const AppSidebarContext = createContext<AppSidebarContextValue | null>(null);

export const AppSidebarProvider = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const [attachmentSection, setAttachmentSection] = useState<AttachmentSection>("all");
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>("all");
  const [memoDetail, setMemoDetailState] = useState<MemoDetailSidebarDescriptor>();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pendingMobileCloseActionRef = useRef<(() => void) | undefined>(undefined);
  const scheduledMobileCloseActionFrameRef = useRef<number | undefined>(undefined);
  const [quickFindOpen, setQuickFindOpen] = useState(false);
  const [memoScope, setMemoScope] = useState<PrimaryMemoScope>("home");

  useEffect(() => {
    pendingMobileCloseActionRef.current = undefined;
    if (scheduledMobileCloseActionFrameRef.current !== undefined) {
      window.cancelAnimationFrame(scheduledMobileCloseActionFrameRef.current);
      scheduledMobileCloseActionFrameRef.current = undefined;
    }
    setMobileOpen(false);
    setAttachmentSection("all");
    setInboxFilter("all");

    return () => {
      pendingMobileCloseActionRef.current = undefined;
      if (scheduledMobileCloseActionFrameRef.current !== undefined) {
        window.cancelAnimationFrame(scheduledMobileCloseActionFrameRef.current);
        scheduledMobileCloseActionFrameRef.current = undefined;
      }
    };
  }, [location.pathname]);

  const setMemoDetail = useCallback((descriptor?: MemoDetailSidebarDescriptor) => {
    setMemoDetailState(descriptor);
  }, []);

  const closeMobileThen = useCallback(
    (action: () => void) => {
      if (!mobileOpen) {
        action();
        return;
      }

      pendingMobileCloseActionRef.current = action;
      setMobileOpen(false);
    },
    [mobileOpen],
  );

  const completeMobileClose = useCallback((open: boolean) => {
    if (open) return;
    const action = pendingMobileCloseActionRef.current;
    pendingMobileCloseActionRef.current = undefined;
    if (!action) return;

    // Base UI restores focus in a microtask after the Sheet unmounts. Run the destination
    // action on the next frame so an editor's focus cannot be overwritten by that cleanup.
    scheduledMobileCloseActionFrameRef.current = window.requestAnimationFrame(() => {
      scheduledMobileCloseActionFrameRef.current = undefined;
      action();
    });
  }, []);

  const value = useMemo(
    () => ({
      attachmentSection,
      setAttachmentSection,
      inboxFilter,
      setInboxFilter,
      memoDetail,
      setMemoDetail,
      mobileOpen,
      setMobileOpen,
      closeMobileThen,
      completeMobileClose,
      quickFindOpen,
      setQuickFindOpen,
      memoScope,
      setMemoScope,
    }),
    [attachmentSection, inboxFilter, memoDetail, setMemoDetail, mobileOpen, closeMobileThen, completeMobileClose, quickFindOpen, memoScope],
  );

  return <AppSidebarContext.Provider value={value}>{children}</AppSidebarContext.Provider>;
};

export const useAppSidebar = () => {
  const context = useContext(AppSidebarContext);
  if (!context) {
    throw new Error("useAppSidebar must be used within AppSidebarProvider");
  }
  return context;
};
