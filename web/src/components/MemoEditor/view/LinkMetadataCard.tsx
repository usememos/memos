import type React from "react";
import { useEffect, useState } from "react";
import { useLinkMetadata } from "@/hooks/useMemoQueries";
import { cn } from "@/lib/utils";

interface LinkMetadataCardProps {
  url: string;
  fallback: React.ReactNode;
  enabled?: boolean;
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

const LinkMetadataCard = ({ url, fallback, enabled = true }: LinkMetadataCardProps) => {
  const [imageFailed, setImageFailed] = useState(false);
  const { data: metadata, isSuccess } = useLinkMetadata(url, { enabled });

  const title = metadata?.title.trim() ?? "";
  const description = metadata?.description.trim() ?? "";
  const image = metadata?.image.trim() ?? "";
  const hostname = getHostname(metadata?.url || url);
  const hasUsefulMetadata = title !== "" || description !== "";

  useEffect(() => {
    setImageFailed(false);
  }, [url, image]);

  if (!isSuccess || !hasUsefulMetadata) {
    return fallback;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group my-0 mb-2 flex w-full max-w-full overflow-hidden rounded-mu-md border border-mu-line bg-mu-well/20 text-mu-ink no-underline transition-colors",
        "hover:border-mu-primary/35 hover:bg-mu-hover/20",
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 px-2.5 py-2 sm:gap-1 sm:px-3 sm:py-2.5">
        {hostname && <span className="truncate mu-caption text-mu-ink-muted">{hostname}</span>}
        {title && <span className="line-clamp-2 mu-label text-mu-ink">{title}</span>}
        {description && <span className="line-clamp-1 mu-caption text-mu-ink-muted sm:line-clamp-2">{description}</span>}
      </span>
      {image && !imageFailed && (
        <span className="flex w-24 shrink-0 items-center border-s border-mu-line/70 bg-mu-well/40 sm:w-40">
          <span className="aspect-[1.91/1] w-full overflow-hidden">
            <img
              src={image}
              alt=""
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.01]"
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setImageFailed(true)}
            />
          </span>
        </span>
      )}
    </a>
  );
};

export default LinkMetadataCard;
