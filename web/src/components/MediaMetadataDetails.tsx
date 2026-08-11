import {
  ApertureIcon,
  CalendarArrowUpIcon,
  CalendarClockIcon,
  CameraIcon,
  CheckIcon,
  CopyIcon,
  FileType2Icon,
  FocusIcon,
  type LucideIcon,
  MapIcon,
  MapPinIcon,
  RotateCwIcon,
  ScanIcon,
  TimerIcon,
  XIcon,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { LazyLocationPicker } from "@/components/map/LazyLocationPicker";
import { Button } from "@/components/ui/button";
import i18n from "@/i18n";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import type { PreviewMediaItem } from "@/utils/media-item";
import { buildMediaMetadataDisplay } from "@/utils/media-metadata";

interface DetailRowProps {
  icon: LucideIcon;
  label: string;
  value: string;
  secondary?: string;
  action?: ReactNode;
}

interface MediaMetadataDetailsProps {
  id: string;
  item: PreviewMediaItem;
  onClose: () => void;
  className?: string;
}

const DetailRow = ({ icon: Icon, label, value, secondary, action }: DetailRowProps) => (
  <div className="grid grid-cols-[1rem_minmax(0,1fr)_auto] gap-x-2.5 py-2.5">
    <Icon className="mt-0.5 size-3.5 text-white/38" strokeWidth={1.75} aria-hidden="true" />
    <div className="min-w-0">
      <div className="text-[11px] font-medium leading-4 text-white/45">{label}</div>
      <div className="mt-0.5 break-words text-[13px] leading-5 text-white/88 tabular-nums">{value}</div>
      {secondary && <div className="mt-0.5 text-[11px] leading-4 text-white/48">{secondary}</div>}
    </div>
    {action && <div className="self-center">{action}</div>}
  </div>
);

const DetailSection = ({ title, children }: { title: string; children: ReactNode }) => (
  <section>
    <h3 className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/32">{title}</h3>
    <div className="divide-y divide-white/[0.07]">{children}</div>
  </section>
);

const IconAction = ({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) => (
  <Button
    type="button"
    variant="ghost"
    size="icon"
    title={label}
    aria-label={label}
    onClick={onClick}
    className="inline-flex size-7 items-center justify-center rounded-full text-white/48 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45"
  >
    {children}
  </Button>
);

const MediaMetadataDetails = ({ id, item, onClose, className }: MediaMetadataDetailsProps) => {
  const t = useTranslate();
  const [showMap, setShowMap] = useState(false);
  const [coordinatesCopied, setCoordinatesCopied] = useState(false);
  const copyResetTimer = useRef<number | undefined>(undefined);
  const locale = i18n.language;
  const details = useMemo(() => buildMediaMetadataDisplay(item.attachments, locale), [item.attachments, locale]);

  useEffect(() => {
    setShowMap(false);
    setCoordinatesCopied(false);
  }, [item.id]);

  useEffect(
    () => () => {
      if (copyResetTimer.current !== undefined) {
        window.clearTimeout(copyResetTimer.current);
      }
    },
    [],
  );

  const copyCoordinates = async () => {
    if (!details.location || !navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(`${details.location.latitude}, ${details.location.longitude}`);
    } catch {
      return;
    }
    setCoordinatesCopied(true);
    if (copyResetTimer.current !== undefined) {
      window.clearTimeout(copyResetTimer.current);
    }
    copyResetTimer.current = window.setTimeout(() => setCoordinatesCopied(false), 1600);
  };

  const hasFileDetails = Boolean(details.file || details.dimensions || details.duration || details.uploaded);
  const hasCaptureDetails = Boolean(details.captured);
  const hasCameraDetails = Boolean(details.camera || details.lens || details.exposure);

  return (
    <aside
      id={id}
      aria-label={t("attachment-details.title")}
      className={cn(
        "absolute inset-x-0 bottom-0 z-40 flex max-h-[72vh] flex-col overflow-hidden rounded-t-2xl border-t border-white/10 bg-neutral-950/96 text-white shadow-2xl backdrop-blur-xl lg:inset-y-0 lg:left-auto lg:w-[22rem] lg:max-h-none lg:rounded-none lg:border-l lg:border-t-0 lg:bg-black/82",
        className,
      )}
    >
      <div className="mx-auto mt-2 h-1 w-8 rounded-full bg-white/18 lg:hidden" aria-hidden="true" />
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.08] px-4 pb-3 pt-3 lg:pt-20">
        <div>
          <h2 className="text-sm font-medium text-white/92">{t("attachment-details.title")}</h2>
          <p className="mt-0.5 max-w-[16rem] truncate text-xs text-white/42">{item.filename}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex size-8 items-center justify-center rounded-full text-white/55 hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 lg:hidden"
          aria-label={t("attachment-details.actions.hide")}
        >
          <XIcon className="size-4" aria-hidden="true" />
        </button>
      </header>

      <div className="overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
        <div className="space-y-5">
          {hasFileDetails && (
            <DetailSection title={t("attachment-details.sections.file")}>
              {details.file && <DetailRow icon={FileType2Icon} label={t("attachment-details.fields.file")} value={details.file} />}
              {details.dimensions && (
                <DetailRow icon={ScanIcon} label={t("attachment-details.fields.dimensions")} value={details.dimensions} />
              )}
              {details.duration && <DetailRow icon={TimerIcon} label={t("attachment-details.fields.duration")} value={details.duration} />}
              {details.uploaded && (
                <DetailRow icon={CalendarArrowUpIcon} label={t("attachment-details.fields.uploaded")} value={details.uploaded} />
              )}
            </DetailSection>
          )}

          {hasCaptureDetails && (
            <DetailSection title={t("attachment-details.sections.capture")}>
              <DetailRow
                icon={CalendarClockIcon}
                label={t("attachment-details.fields.captured")}
                value={details.captured!}
                secondary={
                  details.utcOffset
                    ? details.utcOffset === "Z"
                      ? "UTC"
                      : `UTC${details.utcOffset}`
                    : t("attachment-details.timezone-unknown")
                }
              />
            </DetailSection>
          )}

          {hasCameraDetails && (
            <DetailSection title={t("attachment-details.sections.camera")}>
              {details.camera && <DetailRow icon={CameraIcon} label={t("attachment-details.fields.camera")} value={details.camera} />}
              {details.lens && <DetailRow icon={FocusIcon} label={t("attachment-details.fields.lens")} value={details.lens} />}
              {details.exposure && (
                <DetailRow icon={ApertureIcon} label={t("attachment-details.fields.exposure")} value={details.exposure} />
              )}
            </DetailSection>
          )}

          {details.location && (
            <DetailSection title={t("attachment-details.sections.location")}>
              <DetailRow
                icon={MapPinIcon}
                label={t("attachment-details.fields.location")}
                value={details.location.coordinates}
                secondary={
                  details.location.altitude ? `${t("attachment-details.fields.altitude")} · ${details.location.altitude}` : undefined
                }
                action={
                  <IconAction
                    label={coordinatesCopied ? t("attachment-details.actions.copied") : t("attachment-details.actions.copy-coordinates")}
                    onClick={() => void copyCoordinates()}
                  >
                    {coordinatesCopied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
                  </IconAction>
                }
              />
              <button
                type="button"
                onClick={() => setShowMap((visible) => !visible)}
                className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-full border border-white/10 px-3 text-xs text-white/62 transition-colors hover:border-white/18 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45"
              >
                <MapIcon className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                {showMap ? t("attachment-details.actions.hide-map") : t("attachment-details.actions.show-map")}
              </button>
              {showMap && (
                <LazyLocationPicker
                  className="mt-3 h-44 rounded-xl border-white/10"
                  latlng={{ lat: details.location.latitude, lng: details.location.longitude }}
                  readonly
                />
              )}
            </DetailSection>
          )}

          {!details.hasSavedMetadata && (
            <p className="rounded-xl border border-white/[0.07] px-3 py-2.5 text-xs leading-5 text-white/42">
              {t("attachment-details.empty")}
            </p>
          )}

          {details.sourceExifOrientation !== undefined && (
            <details className="group border-t border-white/[0.08] pt-3">
              <summary className="cursor-pointer select-none text-[11px] font-medium text-white/42 hover:text-white/65">
                {t("attachment-details.sections.technical")}
              </summary>
              <div className="mt-2">
                <DetailRow
                  icon={RotateCwIcon}
                  label={t("attachment-details.fields.source-orientation")}
                  value={String(details.sourceExifOrientation)}
                />
              </div>
            </details>
          )}
        </div>
      </div>
    </aside>
  );
};

export default MediaMetadataDetails;
