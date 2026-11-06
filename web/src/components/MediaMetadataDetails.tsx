import { Button } from "@usememos/ui";
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
    <Icon className="mu-icon-sm mt-0.5 text-mu-ink-muted" aria-hidden="true" />
    <div className="min-w-0">
      <div className="mu-label-sm text-mu-ink-muted">{label}</div>
      <div className="mt-0.5 break-words mu-caption text-mu-ink tabular-nums">{value}</div>
      {secondary && <div className="mt-0.5 mu-caption text-mu-ink-muted">{secondary}</div>}
    </div>
    {action && <div className="self-center">{action}</div>}
  </div>
);

const DetailSection = ({ title, children }: { title: string; children: ReactNode }) => (
  <section>
    <h3 className="mb-0.5 mu-label-sm text-mu-ink-muted">{title}</h3>
    <div className="divide-y divide-mu-line">{children}</div>
  </section>
);

const MediaMetadataDetails = ({ id, item, onClose, className }: MediaMetadataDetailsProps) => {
  const t = useTranslate();
  const [showMap, setShowMap] = useState(false);
  const [coordinatesCopied, setCoordinatesCopied] = useState(false);
  const copyResetTimer = useRef<number | undefined>(undefined);
  const locale = i18n.language;
  const details = useMemo(() => buildMediaMetadataDisplay(item.attachments, locale), [item.attachments, locale]);
  const copyCoordinatesLabel = coordinatesCopied
    ? t("attachment-details.actions.copied")
    : t("attachment-details.actions.copy-coordinates");

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
    // The panel sits over the photo, so it is a dark-theme scope and draws with the dark tokens whatever the app's theme.
    <aside
      id={id}
      aria-label={t("attachment-details.title")}
      data-theme="dark"
      className={cn(
        "absolute inset-x-0 bottom-0 z-40 flex max-h-[72vh] flex-col overflow-hidden rounded-t-mu-2xl border-t border-mu-line bg-mu-surface/96 text-mu-ink shadow-mu-pop backdrop-blur-xl lg:inset-y-0 lg:left-auto lg:w-[22rem] lg:max-h-none lg:rounded-none lg:border-l lg:border-t-0 lg:bg-mu-surface/85",
        className,
      )}
    >
      <div className="mx-auto mt-2 h-1 w-8 rounded-full bg-mu-ink-muted/40 lg:hidden" aria-hidden="true" />
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-mu-line px-4 pb-3 pt-3 lg:pt-20">
        <div>
          <h2 className="mu-label text-mu-ink">{t("attachment-details.title")}</h2>
          <p className="mt-0.5 max-w-[16rem] truncate mu-caption text-mu-ink-muted">{item.filename}</p>
        </div>
        <Button
          variant="ghost"
          onClick={onClose}
          className="lg:hidden"
          aria-label={t("attachment-details.actions.hide")}
          icon={<XIcon />}
        />
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
                  <Button
                    variant="ghost"
                    size="sm"
                    title={copyCoordinatesLabel}
                    aria-label={copyCoordinatesLabel}
                    icon={coordinatesCopied ? <CheckIcon className="mu-icon-sm" /> : <CopyIcon className="mu-icon-sm" />}
                    onClick={() => void copyCoordinates()}
                  />
                }
              />
              <Button variant="neutral" size="sm" className="mt-2" onClick={() => setShowMap((visible) => !visible)} icon={<MapIcon />}>
                {showMap ? t("attachment-details.actions.hide-map") : t("attachment-details.actions.show-map")}
              </Button>
              {showMap && (
                <LazyLocationPicker
                  className="mt-3 h-44 rounded-mu-xl border-mu-line"
                  latlng={{ lat: details.location.latitude, lng: details.location.longitude }}
                  readonly
                />
              )}
            </DetailSection>
          )}

          {!details.hasSavedMetadata && (
            <p className="rounded-mu-xl border border-mu-line px-3 py-2.5 mu-caption text-mu-ink-muted">{t("attachment-details.empty")}</p>
          )}

          {details.sourceExifOrientation !== undefined && (
            <details className="group border-t border-mu-line pt-3">
              <summary className="cursor-pointer select-none mu-label-sm text-mu-ink-muted hover:text-mu-ink">
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
