import { AudioWaveformIcon, LoaderCircleIcon, SquareIcon, XIcon } from "lucide-react";
import type { FC } from "react";
import { formatAudioTime } from "@/components/MemoMetadata/Attachment/attachmentHelpers";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { useAudioWaveform } from "../hooks/useAudioWaveform";
import type { AudioRecorderPanelProps } from "../types/components";
import { VoiceWaveform } from "./VoiceWaveform";

export const AudioRecorderPanel: FC<AudioRecorderPanelProps> = ({
  audioRecorder,
  mediaStream,
  onStop,
  onCancel,
  onTranscribe,
  canTranscribe = false,
  isTranscribing = false,
}) => {
  const t = useTranslate();
  const { status, elapsedSeconds } = audioRecorder;

  const isRequestingPermission = status === "requesting_permission";
  const isRecording = status === "recording";
  const isTranscribeDisabled = isRequestingPermission || isTranscribing;
  const waveformLevels = useAudioWaveform(mediaStream, isRecording && mediaStream !== null);
  const srStatusText = isTranscribing
    ? t("editor.audio-recorder.transcribing")
    : isRequestingPermission
      ? t("editor.audio-recorder.requesting-permission")
      : t("editor.audio-recorder.recording");

  return (
    <div
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-2.5 py-1.5",
        "dark:bg-muted/20",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {isRequestingPermission || isTranscribing ? (
          <LoaderCircleIcon className="size-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden />
        ) : null}
        <span className="sr-only">{srStatusText}</span>
        <VoiceWaveform levels={waveformLevels} className="max-w-[200px] overflow-hidden" />
        <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
          {isTranscribing ? t("editor.audio-recorder.transcribing") : formatAudioTime(elapsedSeconds)}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1 border-l border-border/60 pl-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-full"
          onClick={onCancel}
          disabled={isTranscribing}
          aria-label={t("common.cancel")}
        >
          <XIcon className="size-4" />
        </Button>
        {canTranscribe && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="-ml-2 inline-flex">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  onClick={onTranscribe}
                  disabled={isTranscribeDisabled}
                  aria-label={t("editor.audio-recorder.transcribe")}
                >
                  <AudioWaveformIcon className="size-4" />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{t("editor.audio-recorder.transcribe")}</p>
            </TooltipContent>
          </Tooltip>
        )}
        <Button
          type="button"
          variant="destructive"
          size="icon"
          className="rounded-full"
          onClick={onStop}
          disabled={isRequestingPermission || isTranscribing}
          aria-label={t("editor.audio-recorder.stop")}
        >
          <SquareIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
};
