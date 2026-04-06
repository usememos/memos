import { LoaderCircleIcon, XIcon } from "lucide-react";
import type { FC } from "react";
import { formatAudioTime } from "@/components/MemoMetadata/Attachment/attachmentHelpers";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import type { AudioRecorderPanelProps } from "../types/components";

export const AudioRecorderPanel: FC<AudioRecorderPanelProps> = ({ audioRecorder, onStop, onCancel }) => {
  const t = useTranslate();
  const { status, elapsedSeconds } = audioRecorder;

  const isRequestingPermission = status === "requesting_permission";

  return (
    <div className="w-full rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex flex-1 gap-2">
          <div className="truncate text-sm font-medium text-foreground">
            {isRequestingPermission ? t("editor.audio-recorder.requesting-permission") : t("editor.audio-recorder.recording")}
          </div>
          <div
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
              isRequestingPermission
                ? "border border-border/60 bg-background text-muted-foreground"
                : "border border-destructive/20 bg-destructive/[0.08] text-destructive",
            )}
          >
            {isRequestingPermission ? (
              <LoaderCircleIcon className="size-3 animate-spin" />
            ) : (
              <span className="size-2 rounded-full bg-destructive" />
            )}
            {formatAudioTime(elapsedSeconds)}
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onCancel} aria-label={t("common.cancel")}>
            <XIcon className="size-4" />
          </Button>
          <Button size="sm" className="gap-1.5" onClick={onStop} disabled={isRequestingPermission}>
            <span className="size-2.5 rounded-[2px] bg-current" aria-hidden="true" />
            {t("editor.audio-recorder.stop")}
          </Button>
        </div>
      </div>
    </div>
  );
};
