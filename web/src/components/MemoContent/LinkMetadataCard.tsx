import type React from "react";
import { useEffect, useState } from "react";
import { useLinkMetadata } from "@/hooks/useMemoQueries";
import { cn } from "@/lib/utils";
import type { LinkMetadata } from "@/types/proto/api/v1/memo_service_pb";
import { getMemoCoverUrl } from "@/utils/attachment";

interface LinkMetadataCardProps {
  url: string;
  fallback: React.ReactNode;
  enabled?: boolean;
  /** Metadata persisted with the memo; used when the live fetch fails or has not resolved. */
  stored?: LinkMetadata;
  memoName?: string;
  shareToken?: string;
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

const LinkMetadataCard = ({ url, fallback, enabled = true, stored, memoName, shareToken }: LinkMetadataCardProps) => {
  const [coverFailed, setCoverFailed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const { data: fetched, isSuccess } = useLinkMetadata(url, { enabled });

  // Live fetch wins; persisted metadata keeps the card alive when the page
  // is gone or the fetch fails.
  const metadata = isSuccess && (fetched?.title.trim() || fetched?.description.trim()) ? fetched : stored;
  const title = metadata?.title.trim() ?? "";
  const description = metadata?.description.trim() ?? "";
  const hasUsefulMetadata = title !== "" || description !== "";

  const coverUrl = stored?.coverAttachmentUid ? getMemoCoverUrl(memoName, stored.coverAttachmentUid, shareToken) : "";
  const liveImage = metadata?.image.trim() || "";
  const image = imageFailed ? "" : coverFailed ? liveImage : coverUrl || liveImage;
  const hostname = getHostname(metadata?.url || url);

  useEffect(() => {
    setCoverFailed(false);
    setImageFailed(false);
  }, [url, coverUrl, liveImage]);

  if (!hasUsefulMetadata) {
    return fallback;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group my-0 mb-2 flex w-full max-w-full overflow-hidden rounded-md border border-border bg-muted/20 text-foreground no-underline transition-colors",
        "hover:border-primary/35 hover:bg-accent/20",
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 px-2.5 py-2 sm:gap-1 sm:px-3 sm:py-2.5">
        {hostname && <span className="truncate text-[11px] leading-4 text-muted-foreground sm:text-xs">{hostname}</span>}
        {title && <span className="line-clamp-2 text-sm font-medium leading-5 text-foreground">{title}</span>}
        {description && <span className="line-clamp-1 text-xs leading-4 text-muted-foreground sm:line-clamp-2">{description}</span>}
      </span>
      {image && !imageFailed && (
        <span className="flex w-24 shrink-0 items-center border-s border-border/70 bg-muted/40 sm:w-40">
          <span className="aspect-[1.91/1] w-full overflow-hidden">
            <img
              src={image}
              alt=""
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.01]"
              loading="lazy"
              decoding="async"
              onError={() => {
                if (!coverFailed && coverUrl && liveImage) {
                  setCoverFailed(true);
                } else {
                  setImageFailed(true);
                }
              }}
            />
          </span>
        </span>
      )}
    </a>
  );
};

export default LinkMetadataCard;
