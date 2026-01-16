import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";

interface AttachmentPreviewState {
  isOpen: boolean;
  currentAttachment: Attachment | null;
  attachments: Attachment[];
  currentIndex: number;
}

interface AttachmentPreviewActions {
  openPreview: (attachment: Attachment, attachments?: Attachment[]) => void;
  closePreview: () => void;
  goToNext: () => void;
  goToPrevious: () => void;
  goToIndex: (index: number) => void;
}

type AttachmentPreviewContextType = AttachmentPreviewState & AttachmentPreviewActions;

const AttachmentPreviewContext = createContext<AttachmentPreviewContextType | null>(null);

export function AttachmentPreviewProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AttachmentPreviewState>({
    isOpen: false,
    currentAttachment: null,
    attachments: [],
    currentIndex: 0,
  });

  const openPreview = useCallback((attachment: Attachment, attachments: Attachment[] = []) => {
    const allAttachments = attachments.length > 0 ? attachments : [attachment];
    const index = allAttachments.findIndex((a) => a.name === attachment.name);
    setState({
      isOpen: true,
      currentAttachment: attachment,
      attachments: allAttachments,
      currentIndex: index >= 0 ? index : 0,
    });
  }, []);

  const closePreview = useCallback(() => {
    setState({
      isOpen: false,
      currentAttachment: null,
      attachments: [],
      currentIndex: 0,
    });
  }, []);

  const goToNext = useCallback(() => {
    setState((prev) => {
      if (prev.currentIndex < prev.attachments.length - 1) {
        const nextIndex = prev.currentIndex + 1;
        return {
          ...prev,
          currentIndex: nextIndex,
          currentAttachment: prev.attachments[nextIndex],
        };
      }
      return prev;
    });
  }, []);

  const goToPrevious = useCallback(() => {
    setState((prev) => {
      if (prev.currentIndex > 0) {
        const prevIndex = prev.currentIndex - 1;
        return {
          ...prev,
          currentIndex: prevIndex,
          currentAttachment: prev.attachments[prevIndex],
        };
      }
      return prev;
    });
  }, []);

  const goToIndex = useCallback((index: number) => {
    setState((prev) => {
      if (index >= 0 && index < prev.attachments.length) {
        return {
          ...prev,
          currentIndex: index,
          currentAttachment: prev.attachments[index],
        };
      }
      return prev;
    });
  }, []);

  return (
    <AttachmentPreviewContext.Provider
      value={{
        ...state,
        openPreview,
        closePreview,
        goToNext,
        goToPrevious,
        goToIndex,
      }}
    >
      {children}
    </AttachmentPreviewContext.Provider>
  );
}

export function useAttachmentPreview(): AttachmentPreviewContextType {
  const context = useContext(AttachmentPreviewContext);
  if (!context) {
    throw new Error("useAttachmentPreview must be used within an AttachmentPreviewProvider");
  }
  return context;
}
