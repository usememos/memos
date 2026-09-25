import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { useTranslate } from "@/utils/i18n";
import { errorService, transcriptionService } from "../services";

/** Transcribes an existing attachment into the draft without changing the original audio. */
export const useAttachmentTranscription = (onText: (text: string) => void) => {
  const t = useTranslate();
  const [transcribingAttachment, setTranscribingAttachment] = useState<string>();
  const request = useRef<AbortController | undefined>(undefined);

  useEffect(() => () => request.current?.abort(), []);

  const transcribeAttachment = useCallback(
    async (attachment: Attachment) => {
      if (request.current) return;
      const controller = new AbortController();
      request.current = controller;
      setTranscribingAttachment(attachment.name);
      try {
        const text = (await transcriptionService.transcribeAttachment(attachment, controller.signal)).trim();
        if (controller.signal.aborted) return;
        if (!text) {
          toast.error(t("editor.audio-recorder.transcribe-empty"));
          return;
        }
        onText(text);
        toast.success(t("editor.audio-recorder.transcribe-success"));
      } catch (error) {
        if (!controller.signal.aborted) {
          toast.error(errorService.getErrorMessage(error) || t("editor.audio-recorder.transcribe-error"));
        }
      } finally {
        request.current = undefined;
        if (!controller.signal.aborted) setTranscribingAttachment(undefined);
      }
    },
    [onText, t],
  );

  return { transcribeAttachment, transcribingAttachment };
};
