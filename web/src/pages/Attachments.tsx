import { create } from "@bufbuild/protobuf";
import { LoaderCircleIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "react-hot-toast";
import {
  AttachmentAudioRows,
  AttachmentDocumentRows,
  AttachmentLibraryEmptyState,
  AttachmentLibraryErrorState,
  AttachmentLibrarySkeletonGrid,
  AttachmentMediaGrid,
  AttachmentUnusedRows,
} from "@/components/AttachmentLibrary";
import ConfirmDialog from "@/components/ConfirmDialog";
import PreviewImageDialog from "@/components/PreviewImageDialog";
import { Button } from "@/components/ui/button";
import { attachmentServiceClient } from "@/connect";
import { useAppSidebar } from "@/contexts/AppSidebarContext";
import { useAttachmentLibrary, useUnusedAttachmentLibrary } from "@/hooks/useAttachmentLibrary";
import { useBatchDeleteAttachments } from "@/hooks/useAttachmentQueries";
import useDialog from "@/hooks/useDialog";
import i18n from "@/i18n";
import { handleError } from "@/lib/error";
import { ListAttachmentsRequestSchema } from "@/types/proto/api/v1/attachment_service_pb";
import { useTranslate } from "@/utils/i18n";

const UNUSED_PAGE_SIZE = 1000;
const BATCH_DELETE_SIZE = 100;

const chunkNames = (names: string[], size: number) => {
  const chunks: string[][] = [];

  for (let index = 0; index < names.length; index += size) {
    chunks.push(names.slice(index, index + size));
  }

  return chunks;
};

const listUnusedAttachmentNames = async () => {
  const names: string[] = [];
  let pageToken = "";

  do {
    const response = await attachmentServiceClient.listAttachments(
      create(ListAttachmentsRequestSchema, {
        filter: "memo_id == null",
        pageSize: UNUSED_PAGE_SIZE,
        pageToken,
      }),
    );

    names.push(...response.attachments.map((attachment) => attachment.name));
    pageToken = response.nextPageToken;
  } while (pageToken);

  return names;
};

const Attachments = () => {
  const t = useTranslate();
  const deleteUnusedAttachmentsDialog = useDialog();
  const { attachmentSection } = useAppSidebar();
  const [previewState, setPreviewState] = useState({ open: false, initialIndex: 0 });
  const { mutateAsync: batchDeleteAttachments, isPending: isDeletingUnused } = useBatchDeleteAttachments();
  const {
    audioItems,
    documentItems,
    error,
    fetchNextPage,
    hasNextPage,
    isError,
    isFetching,
    isFetchingNextPage,
    isLoading,
    mediaGroups,
    mediaPreviewItems,
    refetch,
    stats,
  } = useAttachmentLibrary(i18n.language);
  const {
    error: unusedError,
    isComplete: unusedIsComplete,
    isError: unusedIsError,
    isLoading: unusedIsLoading,
    refetch: refetchUnused,
    unusedItems: completeUnusedItems,
  } = useUnusedAttachmentLibrary(i18n.language, attachmentSection === "unused");

  const handlePreview = (itemId: string) => {
    const initialIndex = mediaPreviewItems.findIndex((item) => item.id === itemId);
    setPreviewState({ open: true, initialIndex: initialIndex >= 0 ? initialIndex : 0 });
  };

  const handleDeleteUnusedAttachments = async () => {
    try {
      const names = await listUnusedAttachmentNames();

      if (names.length === 0) {
        await Promise.all([refetch(), refetchUnused()]);
        return;
      }

      for (const chunk of chunkNames(names, BATCH_DELETE_SIZE)) {
        await batchDeleteAttachments(chunk);
      }

      toast.success(t("resource.delete-all-unused-success"));
      await Promise.all([refetch(), refetchUnused()]);
    } catch (deleteError) {
      handleError(deleteError, toast.error, {
        context: "Failed to delete unused attachments",
        fallbackMessage: t("resource.delete-all-unused-error"),
      });
    }
  };

  const renderContent = () => {
    if (attachmentSection === "unused") {
      if (unusedIsError) {
        return (
          <AttachmentLibraryErrorState error={unusedError instanceof Error ? unusedError : undefined} onRetry={() => refetchUnused()} />
        );
      }

      if (unusedIsLoading || !unusedIsComplete) {
        return <AttachmentLibrarySkeletonGrid />;
      }

      return completeUnusedItems.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">{t("message.no-data")}</div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-medium text-foreground">{t("attachment-library.unused.title")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("attachment-library.unused.description")}</p>
            </div>
            <Button
              variant="destructive"
              className="shrink-0"
              onClick={() => deleteUnusedAttachmentsDialog.open()}
              disabled={isDeletingUnused}
            >
              {isDeletingUnused ? <LoaderCircleIcon className="size-4 animate-spin" /> : <Trash2Icon className="size-4" />}
              {t("resource.delete-all-unused")}
            </Button>
          </div>
          <AttachmentUnusedRows items={completeUnusedItems} />
        </div>
      );
    }

    if (isLoading) {
      return <AttachmentLibrarySkeletonGrid />;
    }

    if (isError) {
      return <AttachmentLibraryErrorState error={error instanceof Error ? error : undefined} onRetry={() => refetch()} />;
    }

    if (attachmentSection === "all") {
      const total = stats.media + stats.documents + stats.audio;
      if (total === 0) return <div className="py-16 text-center text-sm text-muted-foreground">{t("attachment-library.empty.all")}</div>;
      return (
        <div className="space-y-9">
          {stats.media > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-foreground">{t("attachment-library.tabs.media")}</h2>
              <AttachmentMediaGrid groups={mediaGroups} onPreview={handlePreview} />
            </section>
          )}
          {stats.documents > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-foreground">{t("attachment-library.tabs.documents")}</h2>
              <AttachmentDocumentRows items={documentItems} />
            </section>
          )}
          {stats.audio > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-foreground">{t("attachment-library.tabs.audio")}</h2>
              <AttachmentAudioRows items={audioItems} />
            </section>
          )}
        </div>
      );
    }

    if (attachmentSection === "media") {
      if (stats.media === 0) return <AttachmentLibraryEmptyState tab="media" />;
      return <AttachmentMediaGrid groups={mediaGroups} onPreview={handlePreview} />;
    }

    if (attachmentSection === "documents") {
      if (stats.documents === 0) return <AttachmentLibraryEmptyState tab="documents" />;
      return <AttachmentDocumentRows items={documentItems} />;
    }

    if (attachmentSection === "audio") {
      if (stats.audio === 0) return <AttachmentLibraryEmptyState tab="audio" />;
      return <AttachmentAudioRows items={audioItems} />;
    }

    return null;
  };

  return (
    <section className="@container min-h-full w-full pb-10 pt-3 md:pt-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 sm:gap-6 sm:px-6">
        <div className="min-h-[16rem] pt-1">
          {renderContent()}

          {attachmentSection !== "unused" && hasNextPage && (
            <div className="mt-6 flex justify-center">
              <Button variant="outline" className="rounded-full px-4" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                {isFetchingNextPage ? <LoaderCircleIcon className="h-4 w-4 animate-spin" /> : null}
                {isFetchingNextPage ? t("resource.fetching-data") : t("memo.load-more")}
              </Button>
            </div>
          )}

          {!isLoading && isFetching && !isFetchingNextPage && (
            <div className="mt-4 text-center text-xs text-muted-foreground">{t("resource.fetching-data")}</div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleteUnusedAttachmentsDialog.isOpen}
        onOpenChange={deleteUnusedAttachmentsDialog.setOpen}
        title={t("resource.delete-all-unused-confirm")}
        description={t("attachment-library.unused.confirm-description")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={handleDeleteUnusedAttachments}
        confirmVariant="destructive"
      />

      <PreviewImageDialog
        open={previewState.open}
        onOpenChange={(open) => setPreviewState((prev) => ({ ...prev, open }))}
        items={mediaPreviewItems}
        initialIndex={previewState.initialIndex}
      />
    </section>
  );
};

export default Attachments;
