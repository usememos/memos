import { SparklesIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import LinkPreviewCard from "./LinkPreviewCard";
import type { BaseMetadataProps, LinkPreview } from "./types";

interface LinkPreviewListProps extends BaseMetadataProps {
  previews: LinkPreview[];
  onRemove?: (id: string) => void;
}

const LinkPreviewList = ({ previews, mode, onRemove, className }: LinkPreviewListProps) => {
  const t = useTranslate();

  if (previews.length === 0) {
    return null;
  }

  return (
    <div className={cn("mt-2 flex w-full flex-col gap-2", className)}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <SparklesIcon className="h-3.5 w-3.5" />
        <span>{t("editor.link-preview")}</span>
      </div>

      {previews.map((preview) => (
        <LinkPreviewCard key={preview.id} preview={preview} mode={mode} onRemove={onRemove ? () => onRemove(preview.id) : undefined} />
      ))}
    </div>
  );
};

export default LinkPreviewList;
