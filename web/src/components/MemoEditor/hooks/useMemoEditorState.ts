import { useState } from "react";
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
 * Hook for managing MemoEditor state
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

  const update = <K extends keyof MemoEditorState>(key: K, value: MemoEditorState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  return {
    ...state,
    setMemoVisibility: (v: Visibility) => update("memoVisibility", v),
    setAttachmentList: (v: Attachment[]) => update("attachmentList", v),
    setRelationList: (v: MemoRelation[]) => update("relationList", v),
    setLocation: (v: Location | undefined) => update("location", v),
    toggleFocusMode: () => setState((prev) => ({ ...prev, isFocusMode: !prev.isFocusMode })),
    setUploadingAttachment: (v: boolean) => update("isUploadingAttachment", v),
    setRequesting: (v: boolean) => update("isRequesting", v),
    setComposing: (v: boolean) => update("isComposing", v),
    setDraggingFile: (v: boolean) => update("isDraggingFile", v),
    resetState: () =>
      setState((prev) => ({
        ...prev,
        isRequesting: false,
        attachmentList: [],
        relationList: [],
        location: undefined,
        isDraggingFile: false,
      })),
  };
};
