import { AudioLinesIcon, LoaderCircleIcon, MicIcon, RotateCcwIcon, SquareIcon, Trash2Icon } from "lucide-react";
import type { FC } from "react";
import { AudioAttachmentItem } from "@/components/MemoMetadata/Attachment";
import { formatAudioTime } from "@/components/MemoMetadata/Attachment/attachmentViewHelpers";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import type { VoiceRecorderPanelProps } from "../types/components";

export const VoiceRecorderPanel: FC<VoiceRecorderPanelProps> = ({
  voiceRecorder,
  onStart,
  onStop,
  onKeep,
  onDiscard,
  onRecordAgain,
  onClose,
}) => {
  const t = useTranslate();
  const { status, elapsedSeconds, error, recording } = voiceRecorder;

  const isRecording = status === "recording";
  const isRequestingPermission = status === "requesting_permission";
  const isUnsupported = status === "unsupported";
  const hasRecording = status === "recorded" && recording;

  return (
    <div className="w-full rounded-xl border border-border/60 bg-muted/25 px-3 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background/80 text-muted-foreground",
              isRecording && "border-destructive/30 bg-destructive/10 text-destructive",
              hasRecording && "text-foreground",
            )}
          >
            {isRequestingPermission ? (
              <LoaderCircleIcon className="size-4 animate-spin" />
            ) : hasRecording ? (
              <AudioLinesIcon className="size-4" />
            ) : (
              <MicIcon className="size-4" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-foreground">
              {isRecording
                ? t("editor.voice-recorder.recording")
                : isRequestingPermission
                  ? t("editor.voice-recorder.requesting-permission")
                  : hasRecording
                    ? t("editor.voice-recorder.ready")
                    : isUnsupported
                      ? t("editor.voice-recorder.unsupported")
                      : error
                        ? t("editor.voice-recorder.error")
                        : t("editor.voice-recorder.title")}
            </div>

            <div className="mt-1 text-sm text-muted-foreground">
              {isRecording
                ? t("editor.voice-recorder.recording-description", { duration: formatAudioTime(elapsedSeconds) })
                : isRequestingPermission
                  ? t("editor.voice-recorder.requesting-permission-description")
                  : hasRecording
                    ? t("editor.voice-recorder.ready-description")
                    : isUnsupported
                      ? t("editor.voice-recorder.unsupported-description")
                      : error
                        ? error
                        : t("editor.voice-recorder.idle-description")}
            </div>
          </div>
        </div>

        {isRecording && (
          <div className="inline-flex items-center gap-2 rounded-full border border-destructive/20 bg-destructive/[0.08] px-2.5 py-1 text-xs font-medium text-destructive">
            <span className="size-2 rounded-full bg-destructive" />
            {formatAudioTime(elapsedSeconds)}
          </div>
        )}
      </div>

      {hasRecording && (
        <div className="mt-3">
          <AudioAttachmentItem
            filename={recording.localFile.file.name}
            displayName="Voice note"
            sourceUrl={recording.localFile.previewUrl}
            mimeType={recording.mimeType}
            size={recording.localFile.file.size}
          />
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        {hasRecording ? (
          <>
            <Button variant="ghost" size="sm" onClick={onDiscard}>
              <Trash2Icon />
              {t("editor.voice-recorder.discard")}
            </Button>
            <Button variant="outline" size="sm" onClick={onRecordAgain}>
              <RotateCcwIcon />
              {t("editor.voice-recorder.record-again")}
            </Button>
            <Button size="sm" onClick={onKeep}>
              <AudioLinesIcon />
              {t("editor.voice-recorder.keep")}
            </Button>
          </>
        ) : isRecording ? (
          <Button size="sm" onClick={onStop}>
            <SquareIcon />
            {t("editor.voice-recorder.stop")}
          </Button>
        ) : (
          <>
            <Button variant="ghost" size="sm" onClick={onClose}>
              {t("common.close")}
            </Button>
            {!isUnsupported && (
              <Button size="sm" onClick={onStart} disabled={isRequestingPermission}>
                {isRequestingPermission ? <LoaderCircleIcon className="animate-spin" /> : <MicIcon />}
                {isRequestingPermission ? t("editor.voice-recorder.requesting") : t("editor.voice-recorder.start")}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
