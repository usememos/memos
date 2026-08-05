import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import type { MemoScope } from "@/lib/memo-views";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";

export type AttachmentSection = "all" | "media" | "audio" | "documents" | "unused";
export type InboxFilter = "all" | "unread" | "archived";

export interface MemoDetailSidebarDescriptor {
  memo: Memo;
  from?: string;
  readonly?: boolean;
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
  quickFindOpen: boolean;
  setQuickFindOpen: (open: boolean) => void;
  memoScope: MemoScope;
  setMemoScope: (scope: MemoScope) => void;
}

const AppSidebarContext = createContext<AppSidebarContextValue | null>(null);

export const AppSidebarProvider = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const [attachmentSection, setAttachmentSection] = useState<AttachmentSection>("all");
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>("all");
  const [memoDetail, setMemoDetailState] = useState<MemoDetailSidebarDescriptor>();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [quickFindOpen, setQuickFindOpen] = useState(false);
  const [memoScope, setMemoScope] = useState<MemoScope>("home");

  useEffect(() => {
    setMobileOpen(false);
    setAttachmentSection("all");
    setInboxFilter("all");
  }, [location.pathname]);

  const setMemoDetail = useCallback((descriptor?: MemoDetailSidebarDescriptor) => {
    setMemoDetailState(descriptor);
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
      quickFindOpen,
      setQuickFindOpen,
      memoScope,
      setMemoScope,
    }),
    [attachmentSection, inboxFilter, memoDetail, setMemoDetail, mobileOpen, quickFindOpen, memoScope],
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
