import { FileAudioIcon, FileStackIcon, ImageIcon } from "lucide-react";
import type { ComponentType } from "react";
import type { AttachmentLibraryTab } from "@/hooks/useAttachmentLibrary";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";

interface AttachmentLibraryEmptyStateProps {
  className?: string;
  tab: AttachmentLibraryTab;
}

const EMPTY_STATE_CONFIG: Record<
  AttachmentLibraryTab,
  {
    descriptionKey: "attachment-library.empty.audio" | "attachment-library.empty.documents" | "attachment-library.empty.media";
    icon: ComponentType<{ className?: string }>;
    titleKey: "attachment-library.tabs.audio" | "attachment-library.tabs.documents" | "attachment-library.tabs.media";
  }
> = {
  audio: {
    descriptionKey: "attachment-library.empty.audio",
    icon: FileAudioIcon,
    titleKey: "attachment-library.tabs.audio",
  },
  documents: {
    descriptionKey: "attachment-library.empty.documents",
    icon: FileStackIcon,
    titleKey: "attachment-library.tabs.documents",
  },
  media: {
    descriptionKey: "attachment-library.empty.media",
    icon: ImageIcon,
    titleKey: "attachment-library.tabs.media",
  },
};

const AttachmentLibraryEmptyState = ({ className, tab }: AttachmentLibraryEmptyStateProps) => {
  const t = useTranslate();
  const { descriptionKey, icon: Icon, titleKey } = EMPTY_STATE_CONFIG[tab];

  return (
    <div
      className={cn(
        "flex min-h-[18rem] flex-col items-center justify-center rounded-[28px] border border-dashed border-border/70 bg-background/80 px-6 py-16 text-center",
        className,
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/45 text-muted-foreground">
        <Icon className="h-7 w-7" />
      </div>
      <div className="mt-5 text-sm font-medium text-foreground">{t(titleKey)}</div>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{t(descriptionKey)}</p>
    </div>
  );
};

export default AttachmentLibraryEmptyState;
