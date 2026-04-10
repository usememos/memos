import { LoaderCircleIcon, XIcon } from "lucide-react";
import type { FC } from "react";
import { formatAudioTime } from "@/components/MemoMetadata/Attachment/attachmentHelpers";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { useAudioWaveform } from "../hooks/useAudioWaveform";
import type { AudioRecorderPanelProps } from "../types/components";
import { VoiceWaveform } from "./VoiceWaveform";

export const AudioRecorderPanel: FC<AudioRecorderPanelProps> = ({ audioRecorder, mediaStream, onStop, onCancel }) => {
  const t = useTranslate();
  const { status, elapsedSeconds } = audioRecorder;

  const isRequestingPermission = status === "requesting_permission";
  const isRecording = status === "recording";
  const waveformLevels = useAudioWaveform(mediaStream, isRecording && mediaStream !== null);
  const srStatusText = isRequestingPermission ? t("editor.audio-recorder.requesting-permission") : t("editor.audio-recorder.recording");

  return (
    <div
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-2.5 py-1.5",
        "dark:bg-muted/20",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {isRequestingPermission ? <LoaderCircleIcon className="size-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden /> : null}
        <span className="sr-only">{srStatusText}</span>
        <VoiceWaveform levels={waveformLevels} className="max-w-[200px] overflow-hidden" />
        <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{formatAudioTime(elapsedSeconds)}</span>
      </div>

      <div className="flex shrink-0 items-center gap-1 border-l border-border/60 pl-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={onCancel}
          aria-label={t("common.cancel")}
        >
          <XIcon className="size-3.25" />
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="icon"
          className="size-7 shrink-0 rounded-full shadow-xs"
          onClick={onStop}
          disabled={isRequestingPermission}
          aria-label={t("editor.audio-recorder.stop")}
        >
          <span className="size-[7px] rounded-[1.5px] bg-destructive-foreground" aria-hidden />
        </Button>
      </div>
    </div>
  );
};
