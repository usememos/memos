import { ExternalLinkIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";

interface AttachmentMetadataLineProps {
  className?: string;
  items: Array<string | undefined>;
}

interface AttachmentSourceChipProps {
  memoName?: string;
  unlinkedLabelKey?: "attachment-library.labels.not-linked" | "attachment-library.labels.unused";
}

interface AttachmentOpenButtonProps {
  className?: string;
  href: string;
}

export const AttachmentMetadataLine = ({ className, items }: AttachmentMetadataLineProps) => {
  const visibleItems = items.filter((item): item is string => Boolean(item));

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 overflow-x-auto whitespace-nowrap text-xs text-muted-foreground [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {visibleItems.map((item, index) => (
        <span key={`${item}-${index}`} className="contents">
          {index > 0 && <span className="shrink-0 text-muted-foreground/50">•</span>}
          <span className="shrink-0">{item}</span>
        </span>
      ))}
    </div>
  );
};

export const AttachmentSourceChip = ({
  memoName,
  unlinkedLabelKey = "attachment-library.labels.not-linked",
}: AttachmentSourceChipProps) => {
  const t = useTranslate();

  if (!memoName) {
    return (
      <Badge
        variant="outline"
        className="rounded-full border-amber-300/70 bg-amber-50/70 px-1.5 py-0.5 text-[11px] text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/20 dark:text-amber-100"
      >
        {t(unlinkedLabelKey)}
      </Badge>
    );
  }

  return (
    <Link
      to={`/${memoName}`}
      className="inline-flex max-w-full items-center truncate rounded-full border border-border/60 bg-muted/30 px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted/50"
    >
      <span className="truncate">{t("attachment-library.labels.memo")}</span>
    </Link>
  );
};

export const AttachmentOpenButton = ({ className, href }: AttachmentOpenButtonProps) => {
  const t = useTranslate();

  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      className={cn("size-7 shrink-0 rounded-full text-muted-foreground hover:text-foreground", className)}
    >
      <a href={href} target="_blank" rel="noreferrer">
        <ExternalLinkIcon className="h-3.5 w-3.5" />
        <span className="sr-only">{t("attachment-library.actions.open")}</span>
      </a>
    </Button>
  );
};
