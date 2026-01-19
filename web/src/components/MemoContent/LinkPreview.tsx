import { ExternalLinkIcon, Loader2 } from "lucide-react";
import { useLinkMetadata } from "@/hooks/useLinkMetadata";
import { cn } from "@/lib/utils";

interface LinkPreviewProps {
  url: string;
  className?: string;
}

const LinkPreview = ({ url, className }: LinkPreviewProps) => {
  const { data: metadata, isLoading, error } = useLinkMetadata(url, { enabled: true });

  // Don't render if there's an error or no data
  if (error || (!isLoading && !metadata)) {
    return null;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "block w-full mt-2 rounded-lg border border-border bg-muted/20 hover:bg-muted/30 transition-colors overflow-hidden",
        className,
      )}
      onClick={(e) => {
        // Allow the link to open in a new tab
        e.stopPropagation();
      }}
    >
      {isLoading ? (
        <div className="flex items-center justify-center p-4 gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading preview...</span>
        </div>
      ) : metadata ? (
        <div className="flex flex-col sm:flex-row">
          {/* Preview Image */}
          {metadata.image && (
            <div className="w-full sm:w-48 h-32 sm:h-auto sm:min-h-[120px] flex-shrink-0 bg-muted/40 overflow-hidden">
              <img
                src={metadata.image}
                alt={metadata.title || "Link preview"}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => {
                  // Hide image on error
                  e.currentTarget.style.display = "none";
                }}
              />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 p-3 flex flex-col gap-1 min-w-0">
            {/* Title */}
            {metadata.title && <h4 className="text-sm font-semibold text-foreground line-clamp-2 leading-tight">{metadata.title}</h4>}

            {/* Description */}
            {metadata.description && <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{metadata.description}</p>}

            {/* URL */}
            <div className="flex items-center gap-1 mt-auto pt-1">
              <ExternalLinkIcon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <span className="text-xs text-muted-foreground truncate">{getDomainFromUrl(url)}</span>
            </div>
          </div>
        </div>
      ) : null}
    </a>
  );
};

/**
 * Extracts the domain from a URL for display purposes.
 */
function getDomainFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    // Fallback to showing the URL as-is if parsing fails
    return url.length > 50 ? `${url.slice(0, 50)}...` : url;
  }
}

export default LinkPreview;
