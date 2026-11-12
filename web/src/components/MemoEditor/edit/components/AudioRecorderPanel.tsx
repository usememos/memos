import { Button, Spinner, Tooltip } from "@usememos/ui";
import { AudioWaveformIcon, SquareIcon, XIcon } from "lucide-react";
import type { FC } from "react";
import { formatAudioTime } from "@/components/MemoMetadata/Attachment/attachmentHelpers";
import { useTranslate } from "@/utils/i18n";
import { useAudioWaveform } from "../hooks/useAudioWaveform";
import type { AudioRecorderPanelProps } from "../types";
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
    // A 28px row on the text edge, like the toolbar under it: no box inside the composer's box.
    <div className="mu-compact flex h-7 w-full items-center justify-between gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {isRequestingPermission || isTranscribing ? (
          <Spinner size="sm" aria-hidden className="shrink-0 text-mu-ink-muted" />
        ) : (
          <span aria-hidden className="size-2 shrink-0 rounded-full bg-mu-danger motion-safe:animate-pulse" />
        )}
        <span className="mu-visually-hidden">{srStatusText}</span>
        <VoiceWaveform levels={waveformLevels} className="max-w-[200px] overflow-hidden" />
        <span className="shrink-0 font-mono mu-caption tabular-nums text-mu-ink-muted">
          {isTranscribing ? t("editor.audio-recorder.transcribing") : formatAudioTime(elapsedSeconds)}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Tooltip.Root>
          <Tooltip.Trigger
            render={
              <Button
                type="button"
                variant="ghost"
                onClick={onCancel}
                disabled={isTranscribing}
                aria-label={t("common.cancel")}
                icon={<XIcon />}
              />
            }
          />
          <Tooltip.Popup side="top">{t("common.cancel")}</Tooltip.Popup>
        </Tooltip.Root>
        {canTranscribe && (
          <Tooltip.Root>
            <Tooltip.Trigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onTranscribe}
                  disabled={isTranscribeDisabled}
                  focusableWhenDisabled
                  aria-label={t("editor.audio-recorder.transcribe")}
                  icon={<AudioWaveformIcon />}
                />
              }
            />
            <Tooltip.Popup side="top">
              <p>{t("editor.audio-recorder.transcribe")}</p>
            </Tooltip.Popup>
          </Tooltip.Root>
        )}
        <Tooltip.Root>
          <Tooltip.Trigger
            render={
              <Button
                type="button"
                variant="primary"
                onClick={onStop}
                disabled={isRequestingPermission || isTranscribing}
                aria-label={t("editor.audio-recorder.stop")}
                icon={<SquareIcon />}
              />
            }
          />
          <Tooltip.Popup side="top">{t("editor.audio-recorder.stop")}</Tooltip.Popup>
        </Tooltip.Root>
      </div>
    </div>
  );
};
