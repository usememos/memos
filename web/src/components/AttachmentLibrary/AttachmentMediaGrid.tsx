import { PlayIcon } from "lucide-react";
import MotionPhotoPreview from "@/components/MotionPhotoPreview";
import { Badge } from "@/components/ui/badge";
import type { AttachmentLibraryMediaItem, AttachmentLibraryMonthGroup } from "@/hooks/useAttachmentLibrary";
import { useTranslate } from "@/utils/i18n";
import { AttachmentMetadataLine, AttachmentOpenButton } from "./AttachmentLibraryPrimitives";

interface AttachmentMediaGridProps {
  groups: AttachmentLibraryMonthGroup[];
  onPreview: (itemId: string) => void;
}

const AttachmentMediaCard = ({ item, onPreview }: { item: AttachmentLibraryMediaItem; onPreview: () => void }) => {
  const t = useTranslate();

  return (
    <article className="overflow-hidden rounded-[20px] border border-border/60 bg-background/90 shadow-sm shadow-black/[0.03]">
      <button type="button" className="relative block w-full cursor-pointer text-left" onClick={onPreview}>
        <div className="relative aspect-[5/4] overflow-hidden bg-muted/40">
          {item.kind === "video" ? (
            <>
              <video src={item.sourceUrl} poster={item.posterUrl} className="h-full w-full object-cover" preload="metadata" />
              <div className="absolute inset-0 bg-linear-to-t from-black/35 via-black/5 to-transparent" />
              <span className="absolute bottom-2.5 right-2.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/85 text-foreground shadow-sm backdrop-blur-sm">
                <PlayIcon className="h-3.5 w-3.5 fill-current" />
              </span>
            </>
          ) : item.kind === "motion" ? (
            <MotionPhotoPreview
              posterUrl={item.posterUrl}
              motionUrl={item.previewItem.kind === "motion" ? item.previewItem.motionUrl : item.sourceUrl}
              alt={item.filename}
              presentationTimestampUs={item.previewItem.kind === "motion" ? item.previewItem.presentationTimestampUs : undefined}
              containerClassName="h-full w-full"
              mediaClassName="h-full w-full object-cover"
              badgeClassName="left-3 top-3"
            />
          ) : (
            <img src={item.posterUrl} alt={item.filename} className="h-full w-full object-cover" loading="lazy" decoding="async" />
          )}
        </div>
      </button>

      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 truncate text-sm font-medium leading-5 text-foreground" title={item.filename}>
            {item.filename}
          </div>

          {item.kind === "motion" && (
            <Badge variant="outline" className="rounded-full border-border/60 bg-background/70 px-1.5 py-0.5 text-[11px]">
              {t("attachment-library.labels.live")}
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <AttachmentMetadataLine
            className="min-w-0 flex-1"
            items={[item.fileTypeLabel, item.createdLabel !== "—" ? item.createdLabel : undefined]}
          />

          <AttachmentOpenButton href={item.sourceUrl} />
        </div>
      </div>
    </article>
  );
};

const AttachmentMediaGrid = ({ groups, onPreview }: AttachmentMediaGridProps) => {
  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      {groups.map((group) => (
        <section key={group.key} className="space-y-2.5 sm:space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">{group.label}</div>
            <div className="h-px flex-1 bg-border/70" />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {group.items.map((item) => (
              <AttachmentMediaCard key={item.id} item={item} onPreview={() => onPreview(item.previewItem.id)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

export default AttachmentMediaGrid;
