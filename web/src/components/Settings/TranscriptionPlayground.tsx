import { Button, Dialog, Tooltip } from "@usememos/ui";
import copy from "copy-to-clipboard";
import { CheckIcon, CircleAlertIcon, CopyIcon, MicIcon, UploadIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AudioRecorderPanel } from "@/components/MemoEditor/edit/components/AudioRecorderPanel";
import { useAudioRecorder } from "@/components/MemoEditor/edit/hooks/useAudioRecorder";
import { transcriptionService } from "@/components/MemoEditor/edit/services/transcriptionService";
import { getErrorMessage } from "@/lib/error";
import { useTranslate } from "@/utils/i18n";
import PlaygroundSource from "./PlaygroundSource";

type Result = { status: "pending" } | { status: "done"; text: string } | { status: "failed"; message: string };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The saved provider and model, which every run uses. */
  source: string;
  /** The form on the page differs from what is saved. */
  unsaved: boolean;
}

/** Runs Transcribe on audio the administrator records or uploads, the call the composer makes. */
const TranscriptionPlayground = ({ open, onOpenChange, source, unsaved }: Props) => {
  const t = useTranslate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const request = useRef<AbortController | undefined>(undefined);
  const [result, setResult] = useState<Result>();
  const [copied, setCopied] = useState(false);
  // A recording keeps the composer's recorder row up until its transcript arrives.
  const [fromRecording, setFromRecording] = useState(false);
  const pending = result?.status === "pending";

  const transcribe = async (file: File, recorded: boolean) => {
    setFromRecording(recorded);
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setResult({ status: "pending" });
    try {
      const text = await transcriptionService.transcribeFile(file, controller.signal);
      if (!controller.signal.aborted) setResult({ status: "done", text: text.trim() });
    } catch (error) {
      if (!controller.signal.aborted) setResult({ status: "failed", message: getErrorMessage(error) });
    }
  };

  const recorder = useAudioRecorder({ onRecordingComplete: (localFile) => void transcribe(localFile.file, true) });
  const busy = pending || recorder.isBusy;
  const showRecorder = recorder.isBusy || (pending && fromRecording);

  // Closing the dialog, or leaving the page, drops the recording and the request in flight.
  useEffect(() => {
    if (!open) return;
    return () => {
      request.current?.abort();
      recorder.resetRecording();
      setResult((current) => (current?.status === "pending" ? undefined : current));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const recorderError = recorder.status === "error" ? recorder.error : undefined;
  const transcript = result?.status === "done" ? result.text : "";
  const copyLabel = t("setting.ai.copy-transcript");

  // While the recorder row is up it reports the recording and its transcription itself.
  let output: React.ReactNode;
  if (showRecorder) {
    output = <p className="text-mu-text-secondary">{t("setting.ai.transcript-empty")}</p>;
  } else if (pending) {
    output = <p className="text-mu-text-secondary">{t("editor.audio-recorder.transcribing")}</p>;
  } else if (recorderError || result?.status === "failed") {
    output = (
      <p className="flex items-baseline gap-1.5 text-mu-danger">
        <CircleAlertIcon aria-hidden className="mu-icon-sm shrink-0 translate-y-0.5" />
        <span className="min-w-0 wrap-anywhere">{recorderError ?? (result?.status === "failed" ? result.message : "")}</span>
      </p>
    );
  } else if (result?.status === "done") {
    output = transcript ? (
      <p dir="auto" className="whitespace-pre-wrap wrap-anywhere text-mu-text">
        {transcript}
      </p>
    ) : (
      <p className="text-mu-text-secondary">{t("editor.audio-recorder.transcribe-empty")}</p>
    );
  } else {
    output = <p className="text-mu-text-secondary">{t("setting.ai.transcript-empty")}</p>;
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Popup closeLabel={t("common.close")} style={{ "--mu-dialog-width": "40rem" } as React.CSSProperties}>
        <Dialog.Title>{t("setting.ai.try-transcription-title")}</Dialog.Title>
        <Dialog.Description>{t("setting.ai.try-transcription-description")}</Dialog.Description>
        <div className="flex flex-col overflow-hidden rounded-mu-md border border-mu-line">
          <div className="relative min-h-40 px-3 py-2.5 pe-10">
            <div role="status" aria-busy={busy} className="mu-body">
              {output}
            </div>
            {transcript && !busy && (
              <div className="absolute end-1.5 top-1.5">
                <Tooltip.Root>
                  <Tooltip.Trigger
                    render={
                      <Button
                        variant="ghost"
                        icon={copied ? <CheckIcon /> : <CopyIcon />}
                        aria-label={copyLabel}
                        onClick={() => {
                          copy(transcript);
                          setCopied(true);
                        }}
                      />
                    }
                  />
                  <Tooltip.Popup>{copied ? t("message.copied") : copyLabel}</Tooltip.Popup>
                </Tooltip.Root>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-mu-line px-3 py-2">
            {showRecorder ? (
              // The composer's recorder row. Stopping transcribes: there is no draft to attach the audio to.
              <AudioRecorderPanel
                audioRecorder={{ status: recorder.status, elapsedSeconds: recorder.elapsedSeconds }}
                mediaStream={recorder.recordingStream}
                onStop={() => recorder.stopRecording("transcribe")}
                onCancel={recorder.resetRecording}
                isTranscribing={pending}
              />
            ) : (
              <>
                {/* A browser that cannot record can still upload. */}
                {recorder.status !== "unsupported" && (
                  <Button
                    variant="primary"
                    icon={<MicIcon />}
                    disabled={pending}
                    onClick={() => {
                      setResult(undefined);
                      void recorder.startRecording();
                    }}
                  >
                    {t("setting.ai.record")}
                  </Button>
                )}
                <Button variant="neutral" icon={<UploadIcon />} disabled={busy} onClick={() => fileInputRef.current?.click()}>
                  {t("setting.ai.upload-audio")}
                </Button>
                <span className="ms-auto mu-caption text-mu-text-secondary">{t("setting.ai.audio-formats")}</span>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                // A failed recording attempt is over once there is a file to transcribe.
                if (recorder.status === "error") recorder.resetRecording();
                void transcribe(file, false);
              }}
            />
          </div>
        </div>
        <PlaygroundSource source={source} unsaved={unsaved} />
      </Dialog.Popup>
    </Dialog.Root>
  );
};

export default TranscriptionPlayground;
