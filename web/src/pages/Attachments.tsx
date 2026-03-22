import { timestampDate } from "@bufbuild/protobuf/wkt";
import dayjs from "dayjs";
import { ExternalLinkIcon, PaperclipIcon, SearchIcon, Trash } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Link } from "react-router-dom";
import AttachmentIcon from "@/components/AttachmentIcon";
import ConfirmDialog from "@/components/ConfirmDialog";
import Empty from "@/components/Empty";
import MobileHeader from "@/components/MobileHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { attachmentServiceClient } from "@/connect";
import { useDeleteAttachment } from "@/hooks/useAttachmentQueries";
import useDialog from "@/hooks/useDialog";
import useLoading from "@/hooks/useLoading";
import useMediaQuery from "@/hooks/useMediaQuery";
import i18n from "@/i18n";
import { handleError } from "@/lib/error";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { useTranslate } from "@/utils/i18n";

const PAGE_SIZE = 50;

const groupAttachmentsByDate = (attachments: Attachment[]): Map<string, Attachment[]> => {
  const grouped = new Map<string, Attachment[]>();
  const sorted = [...attachments].sort((a, b) => {
    const aTime = a.createTime ? timestampDate(a.createTime) : undefined;
    const bTime = b.createTime ? timestampDate(b.createTime) : undefined;
    return dayjs(bTime).unix() - dayjs(aTime).unix();
  });

  for (const attachment of sorted) {
    const createTime = attachment.createTime ? timestampDate(attachment.createTime) : undefined;
    const monthKey = dayjs(createTime).format("YYYY-MM");
    const group = grouped.get(monthKey) ?? [];
    group.push(attachment);
    grouped.set(monthKey, group);
  }

  return grouped;
};

const filterAttachments = (attachments: Attachment[], searchQuery: string): Attachment[] => {
  if (!searchQuery.trim()) return attachments;
  const query = searchQuery.toLowerCase();
  return attachments.filter((attachment) => attachment.filename.toLowerCase().includes(query));
};

interface AttachmentItemProps {
  attachment: Attachment;
}

const AttachmentItem = ({ attachment }: AttachmentItemProps) => (
  <div className="w-24 sm:w-32 h-auto flex flex-col justify-start items-start">
    <div className="w-24 h-24 flex justify-center items-center sm:w-32 sm:h-32 border border-border overflow-clip rounded-xl cursor-pointer hover:shadow hover:opacity-80">
      <AttachmentIcon attachment={attachment} strokeWidth={0.5} />
    </div>
    <div className="w-full max-w-full flex flex-row justify-between items-center mt-1 px-1">
      <p className="text-xs shrink text-muted-foreground truncate">{attachment.filename}</p>
      {attachment.memo && (
        <Link to={`/${attachment.memo}`} className="text-primary hover:opacity-80 transition-opacity shrink-0 ml-1" aria-label="View memo">
          <ExternalLinkIcon className="w-3 h-3" />
        </Link>
      )}
    </div>
  </div>
);

const Attachments = () => {
  const t = useTranslate();
  const md = useMediaQuery("md");
  const loadingState = useLoading();
  const deleteUnusedAttachmentsDialog = useDialog();
  const { mutateAsync: deleteAttachment } = useDeleteAttachment();

  const [searchQuery, setSearchQuery] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [nextPageToken, setNextPageToken] = useState("");
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Memoized computed values
  const filteredAttachments = useMemo(() => filterAttachments(attachments, searchQuery), [attachments, searchQuery]);

  const usedAttachments = useMemo(() => filteredAttachments.filter((attachment) => attachment.memo), [filteredAttachments]);

  const unusedAttachments = useMemo(() => filteredAttachments.filter((attachment) => !attachment.memo), [filteredAttachments]);

  const groupedAttachments = useMemo(() => groupAttachmentsByDate(usedAttachments), [usedAttachments]);

  // Fetch initial attachments
  useEffect(() => {
    const fetchInitialAttachments = async () => {
      try {
        const { attachments: fetchedAttachments, nextPageToken } = await attachmentServiceClient.listAttachments({
          pageSize: PAGE_SIZE,
        });
        setAttachments(fetchedAttachments);
        setNextPageToken(nextPageToken ?? "");
      } catch (error) {
        handleError(error, toast.error, {
          context: "Failed to fetch attachments",
          fallbackMessage: "Failed to load attachments. Please try again.",
        });
      } finally {
        loadingState.setFinish();
      }
    };

    fetchInitialAttachments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load more attachments with pagination
  const handleLoadMore = useCallback(async () => {
    if (!nextPageToken || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      const { attachments: fetchedAttachments, nextPageToken: newPageToken } = await attachmentServiceClient.listAttachments({
        pageSize: PAGE_SIZE,
        pageToken: nextPageToken,
      });
      setAttachments((prev) => [...prev, ...fetchedAttachments]);
      setNextPageToken(newPageToken ?? "");
    } catch (error) {
      handleError(error, toast.error, {
        context: "Failed to load more attachments",
        fallbackMessage: "Failed to load more attachments. Please try again.",
      });
    } finally {
      setIsLoadingMore(false);
    }
  }, [nextPageToken, isLoadingMore]);

  // Refetch all attachments from the beginning
  const handleRefetch = useCallback(async () => {
    try {
      loadingState.setLoading();
      const { attachments: fetchedAttachments, nextPageToken } = await attachmentServiceClient.listAttachments({
        pageSize: PAGE_SIZE,
      });
      setAttachments(fetchedAttachments);
      setNextPageToken(nextPageToken ?? "");
      loadingState.setFinish();
    } catch (error) {
      handleError(error, toast.error, {
        context: "Failed to refetch attachments",
        fallbackMessage: "Failed to refresh attachments. Please try again.",
        onError: () => loadingState.setError(),
      });
    }
  }, [loadingState]);

  // Delete all unused attachments
  const handleDeleteUnusedAttachments = useCallback(async () => {
    try {
      let allUnusedAttachments: Attachment[] = [];
      let nextPageToken = "";
      do {
        const response = await attachmentServiceClient.listAttachments({
          pageSize: 1000,
          pageToken: nextPageToken,
          filter: "memo_id == null",
        });
        allUnusedAttachments = [...allUnusedAttachments, ...response.attachments];
        nextPageToken = response.nextPageToken;
      } while (nextPageToken);

      await Promise.all(allUnusedAttachments.map((attachment) => deleteAttachment(attachment.name)));
      toast.success(t("resource.delete-all-unused-success"));
    } catch (error) {
      handleError(error, toast.error, {
        context: "Failed to delete unused attachments",
        fallbackMessage: t("resource.delete-all-unused-error"),
      });
    } finally {
      await handleRefetch();
    }
  }, [t, handleRefetch, deleteAttachment]);

  // Handle search input change
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  return (
    <section className="@container w-full max-w-5xl min-h-full flex flex-col justify-start items-center sm:pt-3 md:pt-6 pb-8">
      {!md && <MobileHeader />}
      <div className="w-full px-4 sm:px-6">
        <div className="w-full border border-border flex flex-col justify-start items-start px-4 py-3 rounded-xl bg-background text-foreground">
          <div className="relative w-full flex flex-row justify-between items-center">
            <p className="py-1 flex flex-row justify-start items-center select-none opacity-80">
              <PaperclipIcon className="w-6 h-auto mr-1 opacity-80" />
              <span className="text-lg">{t("common.attachments")}</span>
            </p>
            <div>
              <div className="relative max-w-32">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input className="pl-9" placeholder={t("common.search")} value={searchQuery} onChange={handleSearchChange} />
              </div>
            </div>
          </div>
          <div className="w-full flex flex-col justify-start items-start mt-4 mb-6">
            {loadingState.isLoading ? (
              <div className="w-full h-32 flex flex-col justify-center items-center">
                <p className="w-full text-center text-base my-6 mt-8">{t("resource.fetching-data")}</p>
              </div>
            ) : (
              <>
                {filteredAttachments.length === 0 ? (
                  <div className="w-full mt-8 mb-8 flex flex-col justify-center items-center italic">
                    <Empty />
                    <p className="mt-4 text-muted-foreground">{t("message.no-data")}</p>
                  </div>
                ) : (
                  <>
                    <div className={"w-full h-auto px-2 flex flex-col justify-start items-start gap-y-8"}>
                      {Array.from(groupedAttachments.entries()).map(([monthStr, attachments]) => {
                        return (
                          <div key={monthStr} className="w-full flex flex-row justify-start items-start">
                            <div className="w-16 sm:w-24 pt-4 sm:pl-4 flex flex-col justify-start items-start">
                              <span className="text-sm opacity-60">{dayjs(monthStr).year()}</span>
                              <span className="font-medium text-xl">
                                {dayjs(monthStr).toDate().toLocaleString(i18n.language, { month: "short" })}
                              </span>
                            </div>
                            <div className="w-full max-w-[calc(100%-4rem)] sm:max-w-[calc(100%-6rem)] flex flex-row justify-start items-start gap-4 flex-wrap">
                              {attachments.map((attachment) => (
                                <AttachmentItem key={attachment.name} attachment={attachment} />
                              ))}
                            </div>
                          </div>
                        );
                      })}

                      {unusedAttachments.length > 0 && (
                        <>
                          <Separator />
                          <div className="w-full flex flex-row justify-start items-start">
                            <div className="w-16 sm:w-24 sm:pl-4 flex flex-col justify-start items-start"></div>
                            <div className="w-full max-w-[calc(100%-4rem)] sm:max-w-[calc(100%-6rem)] flex flex-row justify-start items-start gap-4 flex-wrap">
                              <div className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <div className="flex flex-row items-center gap-2">
                                  <span className="text-muted-foreground">{t("resource.unused-resources")}</span>
                                  <span className="text-muted-foreground opacity-80">({unusedAttachments.length})</span>
                                </div>
                                <div>
                                  <Button variant="destructive" onClick={() => deleteUnusedAttachmentsDialog.open()} size="sm">
                                    <Trash />
                                    {t("resource.delete-all-unused")}
                                  </Button>
                                </div>
                              </div>
                              {unusedAttachments.map((attachment) => (
                                <AttachmentItem key={attachment.name} attachment={attachment} />
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    {nextPageToken && (
                      <div className="w-full flex flex-row justify-center items-center mt-4">
                        <Button variant="outline" size="sm" onClick={handleLoadMore} disabled={isLoadingMore}>
                          {isLoadingMore ? t("resource.fetching-data") : t("memo.load-more")}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={deleteUnusedAttachmentsDialog.isOpen}
        onOpenChange={deleteUnusedAttachmentsDialog.setOpen}
        title={t("resource.delete-all-unused-confirm")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={handleDeleteUnusedAttachments}
        confirmVariant="destructive"
      />
    </section>
  );
};

export default Attachments;
