import { Globe2Icon, SparklesIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DisplayMode, LinkPreview } from "./types";

interface LinkPreviewCardProps {
  preview: LinkPreview;
  mode: DisplayMode;
  onRemove?: () => void;
  className?: string;
}

const LinkPreviewCard = ({ preview, mode, onRemove, className }: LinkPreviewCardProps) => {
  const hostname = getHostname(preview.url);

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) =>
    preview.url ? (
      <a href={preview.url} target="_blank" rel="noopener noreferrer" className="no-underline">
        {children}
      </a>
    ) : (
      <div>{children}</div>
    );

  return (
    <Wrapper>
      <div
        className={cn(
          "relative flex w-full gap-3 rounded-md border bg-background/80 p-2 transition-colors",
          "hover:border-muted-foreground/60 hover:bg-accent/40",
          preview.url && "cursor-pointer",
          className,
        )}
      >
        <div className="relative h-24 w-28 shrink-0 overflow-hidden rounded-md border bg-muted/60">
          <img src={preview.imageUrl} alt={preview.title} className="h-full w-full object-cover" loading="lazy" />
          {hostname && (
            <span className="absolute bottom-1 left-1 rounded border bg-background/90 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {preview.siteName || hostname}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-start gap-2">
            <div className="min-w-0 space-y-0.5">
              <p className="line-clamp-2 text-sm font-semibold leading-5">{preview.title}</p>
              <p className="line-clamp-2 text-xs leading-4 text-muted-foreground">{preview.description}</p>
            </div>
            {mode === "edit" && onRemove && (
              <button
                className="rounded-sm p-1 text-muted-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
                onClick={(e) => {
                  e.preventDefault();
                  onRemove();
                }}
                aria-label="Remove preview"
              >
                <XIcon className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 truncate text-xs text-primary">
            <Globe2Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{preview.url}</span>
          </div>
        </div>
      </div>
    </Wrapper>
  );
};

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (_error) {
    return "";
  }
}

export default LinkPreviewCard;
