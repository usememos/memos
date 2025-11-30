import { isEqual } from "lodash-es";
import { useCallback } from "react";
import { toast } from "react-hot-toast";
import type { LocalFile } from "@/components/memo-metadata";
import { memoServiceClient } from "@/grpcweb";
import { attachmentStore, memoStore } from "@/store";
import { Attachment } from "@/types/proto/api/v1/attachment_service";
import type { Location, Memo, MemoRelation, Visibility } from "@/types/proto/api/v1/memo_service";
import type { Translations } from "@/utils/i18n";

interface MemoSaveContext {
  memoName?: string;
  parentMemoName?: string;
  visibility: Visibility;
  attachmentList: Attachment[];
  relationList: MemoRelation[];
  location?: Location;
  localFiles: LocalFile[];
  createTime?: Date;
  updateTime?: Date;
}

interface MemoSaveCallbacks {
  onUploadingChange: (uploading: boolean) => void;
  onRequestingChange: (requesting: boolean) => void;
  onSuccess: (memoName: string) => void;
  onCancel: () => void;
  onReset: () => void;
  t: (key: Translations, params?: Record<string, any>) => string;
}

async function uploadLocalFiles(localFiles: LocalFile[], onUploadingChange: (uploading: boolean) => void): Promise<Attachment[]> {
  if (localFiles.length === 0) return [];

  onUploadingChange(true);
  try {
    const attachments: Attachment[] = [];
    for (const { file } of localFiles) {
      const buffer = new Uint8Array(await file.arrayBuffer());
      const attachment = await attachmentStore.createAttachment({
        attachment: Attachment.fromPartial({
          filename: file.name,
          size: file.size,
          type: file.type,
          content: buffer,
        }),
        attachmentId: "",
      });
      attachments.push(attachment);
    }
    return attachments;
  } finally {
    onUploadingChange(false);
  }
}

function buildUpdateMask(
  prevMemo: Memo,
  content: string,
  allAttachments: Attachment[],
  context: MemoSaveContext,
): { mask: Set<string>; patch: Partial<Memo> } {
  const mask = new Set<string>();
  const patch: Partial<Memo> = {
    name: prevMemo.name,
    content,
  };

  if (!isEqual(content, prevMemo.content)) {
    mask.add("content");
    patch.content = content;
  }
  if (!isEqual(context.visibility, prevMemo.visibility)) {
    mask.add("visibility");
    patch.visibility = context.visibility;
  }
  if (!isEqual(allAttachments, prevMemo.attachments)) {
    mask.add("attachments");
    patch.attachments = allAttachments;
  }
  if (!isEqual(context.relationList, prevMemo.relations)) {
    mask.add("relations");
    patch.relations = context.relationList;
  }
  if (!isEqual(context.location, prevMemo.location)) {
    mask.add("location");
    patch.location = context.location;
  }

  // Auto-update timestamp if content changed
  if (["content", "attachments", "relations", "location"].some((key) => mask.has(key))) {
    mask.add("update_time");
  }

  // Handle custom timestamps
  if (context.createTime && !isEqual(context.createTime, prevMemo.createTime)) {
    mask.add("create_time");
    patch.createTime = context.createTime;
  }
  if (context.updateTime && !isEqual(context.updateTime, prevMemo.updateTime)) {
    mask.add("update_time");
    patch.updateTime = context.updateTime;
  }

  return { mask, patch };
}

export function useMemoSave(callbacks: MemoSaveCallbacks) {
  const { onUploadingChange, onRequestingChange, onSuccess, onCancel, onReset, t } = callbacks;

  const saveMemo = useCallback(
    async (content: string, context: MemoSaveContext) => {
      onRequestingChange(true);

      try {
        // 1. Upload local files
        const newAttachments = await uploadLocalFiles(context.localFiles, onUploadingChange);
        const allAttachments = [...context.attachmentList, ...newAttachments];

        // 2. Update existing memo
        if (context.memoName) {
          const prevMemo = await memoStore.getOrFetchMemoByName(context.memoName);
          if (prevMemo) {
            const { mask, patch } = buildUpdateMask(prevMemo, content, allAttachments, context);

            if (mask.size === 0) {
              toast.error(t("editor.no-changes-detected"));
              onCancel();
              return;
            }

            const memo = await memoStore.updateMemo(patch, Array.from(mask));
            onSuccess(memo.name);
          }
        } else {
          // 3. Create new memo or comment
          const memo = context.parentMemoName
            ? await memoServiceClient.createMemoComment({
                name: context.parentMemoName,
                comment: {
                  content,
                  visibility: context.visibility,
                  attachments: context.attachmentList,
                  relations: context.relationList,
                  location: context.location,
                },
              })
            : await memoStore.createMemo({
                memo: {
                  content,
                  visibility: context.visibility,
                  attachments: allAttachments,
                  relations: context.relationList,
                  location: context.location,
                } as Memo,
                memoId: "",
              });

          onSuccess(memo.name);
        }

        onReset();
      } catch (error: unknown) {
        console.error(error);
        const errorMessage = error instanceof Error ? (error as { details?: string }).details || error.message : "Unknown error";
        toast.error(errorMessage);
      } finally {
        onRequestingChange(false);
      }
    },
    [onUploadingChange, onRequestingChange, onSuccess, onCancel, onReset, t],
  );

  return { saveMemo };
}
