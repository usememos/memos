import { create } from "@bufbuild/protobuf";
import { Button } from "@usememos/ui";
import { Trash2Icon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { attachmentServiceClient } from "@/connect";
import { useAppSidebar } from "@/contexts/AppSidebarContext";
import { useSpaceContext } from "@/contexts/SpaceContext";
import { useAttachmentLibrary, useUnusedAttachmentLibrary } from "@/hooks/useAttachmentLibrary";
import { useBatchDeleteAttachments } from "@/hooks/useAttachmentQueries";
import useCurrentUser from "@/hooks/useCurrentUser";
import useDialog from "@/hooks/useDialog";
import { useUsersByNames } from "@/hooks/useUserQueries";
import i18n from "@/i18n";
import { combineCELFilters } from "@/lib/cel-filter";
import { handleError } from "@/lib/error";
import { showErrorToast, toast } from "@/lib/toast";
import { ListAttachmentsRequestSchema } from "@/types/proto/api/attachment_service_pb";
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

const listUnusedAttachmentNames = async (filter: string | undefined, selectedSpaceName: string | undefined) => {
  if (selectedSpaceName) {
    return [];
  }

  const names: string[] = [];
  let pageToken = "";

  do {
    const response = await attachmentServiceClient.listAttachments(
      create(ListAttachmentsRequestSchema, {
        filter: combineCELFilters("memo_id == null", filter),
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
  const currentUser = useCurrentUser();
  const deleteUnusedAttachmentsDialog = useDialog();
  const { attachmentSection, setAttachmentSection } = useAppSidebar();
  const { memoFilter, selectedSpaceName, creatorUsername } = useSpaceContext();
  const canShowUnused = !selectedSpaceName && (!creatorUsername || creatorUsername === currentUser?.username);
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
  } = useAttachmentLibrary(i18n.language, memoFilter);
  const {
    error: unusedError,
    isComplete: unusedIsComplete,
    isError: unusedIsError,
    isLoading: unusedIsLoading,
    refetch: refetchUnused,
    unusedItems: completeUnusedItems,
  } = useUnusedAttachmentLibrary(i18n.language, memoFilter, attachmentSection === "unused" && canShowUnused);
  const creatorNames = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...mediaGroups.flatMap((group) => group.items.map((item) => item.primaryAttachment.creator)),
            ...documentItems.map((item) => item.attachment.creator),
            ...audioItems.map((item) => item.attachment.creator),
            ...completeUnusedItems.map((item) => item.attachment.creator),
          ].filter(Boolean),
        ),
      ),
    [mediaGroups, documentItems, audioItems, completeUnusedItems],
  );
  const { data: creators } = useUsersByNames(creatorNames);

  useEffect(() => {
    if (!canShowUnused && attachmentSection === "unused") {
      setAttachmentSection("all");
    }
  }, [attachmentSection, canShowUnused, setAttachmentSection]);

  const handlePreview = (itemId: string) => {
    const initialIndex = mediaPreviewItems.findIndex((item) => item.id === itemId);
    setPreviewState({ open: true, initialIndex: initialIndex >= 0 ? initialIndex : 0 });
  };

  const handleDeleteUnusedAttachments = async () => {
    try {
      const names = await listUnusedAttachmentNames(memoFilter, selectedSpaceName);

      if (names.length === 0) {
        await Promise.all([refetch(), refetchUnused()]);
        return;
      }

      for (const chunk of chunkNames(names, BATCH_DELETE_SIZE)) {
        await batchDeleteAttachments(chunk);
      }

      toast.add({ title: t("resource.delete-all-unused-success"), type: "success" });
      await Promise.all([refetch(), refetchUnused()]);
    } catch (deleteError) {
      handleError(deleteError, showErrorToast, {
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
        <div className="py-12 text-center mu-body text-mu-text-secondary">{t("message.no-data")}</div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-mu-xl border border-mu-warning/30 bg-mu-warning-soft p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="mu-label text-mu-text">{t("attachment-library.unused.title")}</h2>
              <p className="mt-1 mu-body text-mu-text-secondary">{t("attachment-library.unused.description")}</p>
            </div>
            <Button
              variant="neutral"
              className="shrink-0"
              onClick={() => deleteUnusedAttachmentsDialog.open()}
              loading={isDeletingUnused}
              loadingLabel={t("resource.delete-all-unused")}
              icon={<Trash2Icon />}
            >
              {t("resource.delete-all-unused")}
            </Button>
          </div>
          <AttachmentUnusedRows items={completeUnusedItems} creators={creators} />
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
      if (total === 0) return <div className="py-16 text-center mu-body text-mu-text-secondary">{t("attachment-library.empty.all")}</div>;
      return (
        <div className="space-y-9">
          {stats.media > 0 && (
            <section className="space-y-3">
              <h2 className="mu-label text-mu-text">{t("attachment-library.tabs.media")}</h2>
              <AttachmentMediaGrid groups={mediaGroups} creators={creators} onPreview={handlePreview} />
            </section>
          )}
          {stats.documents > 0 && (
            <section className="space-y-3">
              <h2 className="mu-label text-mu-text">{t("attachment-library.tabs.documents")}</h2>
              <AttachmentDocumentRows items={documentItems} creators={creators} />
            </section>
          )}
          {stats.audio > 0 && (
            <section className="space-y-3">
              <h2 className="mu-label text-mu-text">{t("attachment-library.tabs.audio")}</h2>
              <AttachmentAudioRows items={audioItems} creators={creators} />
            </section>
          )}
        </div>
      );
    }

    if (attachmentSection === "media") {
      if (stats.media === 0) return <AttachmentLibraryEmptyState tab="media" />;
      return <AttachmentMediaGrid groups={mediaGroups} creators={creators} onPreview={handlePreview} />;
    }

    if (attachmentSection === "documents") {
      if (stats.documents === 0) return <AttachmentLibraryEmptyState tab="documents" />;
      return <AttachmentDocumentRows items={documentItems} creators={creators} />;
    }

    if (attachmentSection === "audio") {
      if (stats.audio === 0) return <AttachmentLibraryEmptyState tab="audio" />;
      return <AttachmentAudioRows items={audioItems} creators={creators} />;
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
              <Button
                variant="neutral"
                onClick={() => fetchNextPage()}
                loading={isFetchingNextPage}
                loadingLabel={t("resource.fetching-data")}
              >
                {isFetchingNextPage ? t("resource.fetching-data") : t("memo.load-more")}
              </Button>
            </div>
          )}

          {!isLoading && isFetching && !isFetchingNextPage && (
            <div className="mt-4 text-center mu-caption text-mu-text-secondary">{t("resource.fetching-data")}</div>
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
        confirmVariant="danger"
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
