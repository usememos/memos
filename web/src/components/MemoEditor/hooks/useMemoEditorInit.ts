import { timestampDate } from "@bufbuild/protobuf/wkt";
import { useEffect, useState } from "react";
import type { LinkPreview } from "@/components/memo-metadata";
import useAsyncEffect from "@/hooks/useAsyncEffect";
import { instanceStore, memoStore, userStore } from "@/store";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import type { Location, MemoRelation } from "@/types/proto/api/v1/memo_service_pb";
import { Visibility } from "@/types/proto/api/v1/memo_service_pb";
import { convertVisibilityFromString } from "@/utils/memo";
import type { EditorRefActions } from "../Editor";
import { extractLinkPreviewsFromContent } from "../utils/linkPreviewSerializer";

export interface UseMemoEditorInitOptions {
  editorRef: React.RefObject<EditorRefActions>;
  memoName?: string;
  parentMemoName?: string;
  contentCache?: string;
  autoFocus?: boolean;
  onEditorFocus: () => void;
  onVisibilityChange: (visibility: Visibility) => void;
  onAttachmentsChange: (attachments: Attachment[]) => void;
  onRelationsChange: (relations: MemoRelation[]) => void;
  onLocationChange: (location: Location | undefined) => void;
  onLinkPreviewsChange?: (previews: LinkPreview[]) => void;
}

export interface UseMemoEditorInitReturn {
  createTime: Date | undefined;
  updateTime: Date | undefined;
  setCreateTime: (time: Date | undefined) => void;
  setUpdateTime: (time: Date | undefined) => void;
}

export const useMemoEditorInit = (options: UseMemoEditorInitOptions): UseMemoEditorInitReturn => {
  const {
    editorRef,
    memoName,
    parentMemoName,
    contentCache,
    autoFocus,
    onEditorFocus,
    onVisibilityChange,
    onAttachmentsChange,
    onRelationsChange,
    onLocationChange,
  } = options;

  const [createTime, setCreateTime] = useState<Date | undefined>();
  const [updateTime, setUpdateTime] = useState<Date | undefined>();
  const userGeneralSetting = userStore.state.userGeneralSetting;
  const instanceMemoRelatedSetting = instanceStore.state.memoRelatedSetting;

  // Initialize content cache
  useEffect(() => {
    const { cleanedContent, previews } = extractLinkPreviewsFromContent(contentCache || "");
    if (previews.length > 0) {
      options.onLinkPreviewsChange?.(previews);
    }
    editorRef.current?.setContent(cleanedContent || "");
  }, []);

  // Auto-focus if requested
  useEffect(() => {
    if (autoFocus) {
      onEditorFocus();
    }
  }, [autoFocus, onEditorFocus]);

  // Set initial visibility based on user settings or parent memo
  useAsyncEffect(async () => {
    let visibility = convertVisibilityFromString(userGeneralSetting?.memoVisibility || "PRIVATE");
    if (instanceMemoRelatedSetting.disallowPublicVisibility && visibility === Visibility.PUBLIC) {
      visibility = Visibility.PROTECTED;
    }
    if (parentMemoName) {
      const parentMemo = await memoStore.getOrFetchMemoByName(parentMemoName);
      visibility = parentMemo.visibility;
    }
    onVisibilityChange(visibility);
  }, [parentMemoName, userGeneralSetting?.memoVisibility, instanceMemoRelatedSetting.disallowPublicVisibility]);

  // Load existing memo if editing
  useAsyncEffect(async () => {
    if (!memoName) {
      return;
    }

    const memo = await memoStore.getOrFetchMemoByName(memoName);
    if (memo) {
      onEditorFocus();
      setCreateTime(memo.createTime ? timestampDate(memo.createTime) : undefined);
      setUpdateTime(memo.updateTime ? timestampDate(memo.updateTime) : undefined);
      onVisibilityChange(memo.visibility);
      onAttachmentsChange(memo.attachments);
      onRelationsChange(memo.relations);
      onLocationChange(memo.location);
      if (!contentCache) {
        const { cleanedContent, previews } = extractLinkPreviewsFromContent(memo.content ?? "");
        if (previews.length > 0) {
          options.onLinkPreviewsChange?.(previews);
        }
        editorRef.current?.setContent(cleanedContent);
      }
    }
  }, [memoName]);

  return {
    createTime,
    updateTime,
    setCreateTime,
    setUpdateTime,
  };
};
