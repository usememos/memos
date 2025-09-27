import dayjs from "dayjs";
import { includes } from "lodash-es";
import { PaperclipIcon, SearchIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import AttachmentIcon from "@/components/AttachmentIcon";
import Empty from "@/components/Empty";
import MobileHeader from "@/components/MobileHeader";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { attachmentServiceClient } from "@/grpcweb";
import useLoading from "@/hooks/useLoading";
import useResponsiveWidth from "@/hooks/useResponsiveWidth";
import i18n from "@/i18n";
import { memoStore } from "@/store";
import { Attachment } from "@/types/proto/api/v1/attachment_service";
import { useTranslate } from "@/utils/i18n";

function groupAttachmentsByDate(attachments: Attachment[]) {
  const grouped = new Map<string, Attachment[]>();
  attachments
    .sort((a, b) => dayjs(b.createTime).unix() - dayjs(a.createTime).unix())
    .forEach((item) => {
      const monthStr = dayjs(item.createTime).format("YYYY-MM");
      if (!grouped.has(monthStr)) {
        grouped.set(monthStr, []);
      }
      grouped.get(monthStr)?.push(item);
    });
  return grouped;
}

interface State {
  searchQuery: string;
}

const Attachments = observer(() => {
  const t = useTranslate();
  const { md } = useResponsiveWidth();
  const loadingState = useLoading();
  const [state, setState] = useState<State>({
    searchQuery: "",
  });
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const filteredAttachments = attachments.filter((attachment) => includes(attachment.filename, state.searchQuery));
  const groupedAttachments = groupAttachmentsByDate(filteredAttachments.filter((attachment) => attachment.memo));
  const unusedAttachments = filteredAttachments.filter((attachment) => !attachment.memo);

  useEffect(() => {
    attachmentServiceClient.listAttachments({}).then(({ attachments }) => {
      setAttachments(attachments);
      loadingState.setFinish();
      Promise.all(attachments.map((attachment) => (attachment.memo ? memoStore.getOrFetchMemoByName(attachment.memo) : null)));
    });
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
                <Input
                  className="pl-9"
                  placeholder={t("common.search")}
                  value={state.searchQuery}
                  onChange={(e) => setState({ ...state, searchQuery: e.target.value })}
                />
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
                            {attachments.map((attachment) => {
                              return (
                                <div key={attachment.name} className="w-24 sm:w-32 h-auto flex flex-col justify-start items-start">
                                  <div className="w-24 h-24 flex justify-center items-center sm:w-32 sm:h-32 border border-border overflow-clip rounded-xl cursor-pointer hover:shadow hover:opacity-80">
                                    <AttachmentIcon attachment={attachment} strokeWidth={0.5} />
                                  </div>
                                  <div className="w-full max-w-full flex flex-row justify-between items-center mt-1 px-1">
                                    <p className="text-xs shrink text-muted-foreground truncate">{attachment.filename}</p>
                                  </div>
                                </div>
                              );
                            })}
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
                            <div className="w-full flex flex-row justify-start items-center gap-2">
                              <span className="text-muted-foreground">{t("resource.unused-resources")}</span>
                              <span className="text-muted-foreground opacity-80">({unusedAttachments.length})</span>
                            </div>
                            {unusedAttachments.map((attachment) => {
                              return (
                                <div key={attachment.name} className="w-24 sm:w-32 h-auto flex flex-col justify-start items-start">
                                  <div className="w-24 h-24 flex justify-center items-center sm:w-32 sm:h-32 border border-border overflow-clip rounded-xl cursor-pointer hover:shadow hover:opacity-80">
                                    <AttachmentIcon attachment={attachment} strokeWidth={0.5} />
                                  </div>
                                  <div className="w-full max-w-full flex flex-row justify-between items-center mt-1 px-1">
                                    <p className="text-xs shrink text-muted-foreground truncate">{attachment.filename}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
});

export default Attachments;
