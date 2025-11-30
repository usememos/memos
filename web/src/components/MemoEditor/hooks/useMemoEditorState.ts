import { useCallback, useState } from "react";
import type { Attachment } from "@/types/proto/api/v1/attachment_service";
import type { Location, MemoRelation } from "@/types/proto/api/v1/memo_service";
import { Visibility } from "@/types/proto/api/v1/memo_service";
import type { MemoEditorState } from "../types/memo-editor";

export interface UseMemoEditorStateReturn {
  state: MemoEditorState;
  memoVisibility: Visibility;
  attachmentList: Attachment[];
  relationList: MemoRelation[];
  location: Location | undefined;
  isFocusMode: boolean;
  isUploadingAttachment: boolean;
  isRequesting: boolean;
  isComposing: boolean;
  isDraggingFile: boolean;

  setMemoVisibility: (visibility: Visibility) => void;
  setAttachmentList: (attachments: Attachment[]) => void;
  setRelationList: (relations: MemoRelation[]) => void;
  setLocation: (location: Location | undefined) => void;
  setIsFocusMode: (isFocusMode: boolean) => void;
  toggleFocusMode: () => void;
  setUploadingAttachment: (isUploading: boolean) => void;
  setRequesting: (isRequesting: boolean) => void;
  setComposing: (isComposing: boolean) => void;
  setDraggingFile: (isDragging: boolean) => void;
  resetState: () => void;
}

/**
 * Hook for managing MemoEditor state
 * Centralizes all state management and provides clean setters
 */
export const useMemoEditorState = (initialVisibility: Visibility = Visibility.PRIVATE): UseMemoEditorStateReturn => {
  const [state, setState] = useState<MemoEditorState>({
    memoVisibility: initialVisibility,
    isFocusMode: false,
    attachmentList: [],
    relationList: [],
    location: undefined,
    isUploadingAttachment: false,
    isRequesting: false,
    isComposing: false,
    isDraggingFile: false,
  });

  const setMemoVisibility = useCallback((visibility: Visibility) => {
    setState((prev) => ({ ...prev, memoVisibility: visibility }));
  }, []);

  const setAttachmentList = useCallback((attachments: Attachment[]) => {
    setState((prev) => ({ ...prev, attachmentList: attachments }));
  }, []);

  const setRelationList = useCallback((relations: MemoRelation[]) => {
    setState((prev) => ({ ...prev, relationList: relations }));
  }, []);

  const setLocation = useCallback((location: Location | undefined) => {
    setState((prev) => ({ ...prev, location }));
  }, []);

  const setIsFocusMode = useCallback((isFocusMode: boolean) => {
    setState((prev) => ({ ...prev, isFocusMode }));
  }, []);

  const toggleFocusMode = useCallback(() => {
    setState((prev) => ({ ...prev, isFocusMode: !prev.isFocusMode }));
  }, []);

  const setUploadingAttachment = useCallback((isUploading: boolean) => {
    setState((prev) => ({ ...prev, isUploadingAttachment: isUploading }));
  }, []);

  const setRequesting = useCallback((isRequesting: boolean) => {
    setState((prev) => ({ ...prev, isRequesting }));
  }, []);

  const setComposing = useCallback((isComposing: boolean) => {
    setState((prev) => ({ ...prev, isComposing }));
  }, []);

  const setDraggingFile = useCallback((isDragging: boolean) => {
    setState((prev) => ({ ...prev, isDraggingFile: isDragging }));
  }, []);

  const resetState = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isRequesting: false,
      attachmentList: [],
      relationList: [],
      location: undefined,
      isDraggingFile: false,
    }));
  }, []);

  return {
    state,
    memoVisibility: state.memoVisibility,
    attachmentList: state.attachmentList,
    relationList: state.relationList,
    location: state.location,
    isFocusMode: state.isFocusMode,
    isUploadingAttachment: state.isUploadingAttachment,
    isRequesting: state.isRequesting,
    isComposing: state.isComposing,
    isDraggingFile: state.isDraggingFile,

    setMemoVisibility,
    setAttachmentList,
    setRelationList,
    setLocation,
    setIsFocusMode,
    toggleFocusMode,
    setUploadingAttachment,
    setRequesting,
    setComposing,
    setDraggingFile,
    resetState,
  };
};
