import { useCallback, useState } from "react";
import type { Attachment } from "@/types/proto/api/v1/attachment_service";
import type { Location, MemoRelation } from "@/types/proto/api/v1/memo_service";
import { Visibility } from "@/types/proto/api/v1/memo_service";

interface MemoEditorState {
  memoVisibility: Visibility;
  attachmentList: Attachment[];
  relationList: MemoRelation[];
  location: Location | undefined;
  isFocusMode: boolean;
  isUploadingAttachment: boolean;
  isRequesting: boolean;
  isComposing: boolean;
  isDraggingFile: boolean;
}

/**
 * Custom hook for managing MemoEditor state with stable setter references.
 *
 * Note: All setter functions are wrapped with useCallback to ensure stable references.
 * This prevents infinite loops when these setters are used in useEffect dependencies.
 * While this makes the code verbose, it's necessary for proper React dependency tracking.
 */
export const useMemoEditorState = (initialVisibility: Visibility = Visibility.PRIVATE) => {
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

  // All setters are memoized with useCallback to provide stable function references.
  // This prevents unnecessary re-renders and infinite loops in useEffect hooks.
  const setMemoVisibility = useCallback((v: Visibility) => {
    setState((prev) => ({ ...prev, memoVisibility: v }));
  }, []);

  const setAttachmentList = useCallback((v: Attachment[]) => {
    setState((prev) => ({ ...prev, attachmentList: v }));
  }, []);

  const setRelationList = useCallback((v: MemoRelation[]) => {
    setState((prev) => ({ ...prev, relationList: v }));
  }, []);

  const setLocation = useCallback((v: Location | undefined) => {
    setState((prev) => ({ ...prev, location: v }));
  }, []);

  const toggleFocusMode = useCallback(() => {
    setState((prev) => ({ ...prev, isFocusMode: !prev.isFocusMode }));
  }, []);

  const setUploadingAttachment = useCallback((v: boolean) => {
    setState((prev) => ({ ...prev, isUploadingAttachment: v }));
  }, []);

  const setRequesting = useCallback((v: boolean) => {
    setState((prev) => ({ ...prev, isRequesting: v }));
  }, []);

  const setComposing = useCallback((v: boolean) => {
    setState((prev) => ({ ...prev, isComposing: v }));
  }, []);

  const setDraggingFile = useCallback((v: boolean) => {
    setState((prev) => ({ ...prev, isDraggingFile: v }));
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
    ...state,
    setMemoVisibility,
    setAttachmentList,
    setRelationList,
    setLocation,
    toggleFocusMode,
    setUploadingAttachment,
    setRequesting,
    setComposing,
    setDraggingFile,
    resetState,
  };
};
