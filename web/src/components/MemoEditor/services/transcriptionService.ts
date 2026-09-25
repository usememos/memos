import { create } from "@bufbuild/protobuf";
import { aiServiceClient } from "@/connect";
import { TranscribeRequestSchema, TranscriptionAudioSchema } from "@/types/proto/api/v1/ai_service_pb";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { getAttachmentUrl } from "@/utils/attachment";

// Keep the browser upload within the transcription API's limit.
const MAX_AUDIO_SIZE = 25 * 1024 * 1024;

const checkAudioSize = (size: number) => {
  if (size > MAX_AUDIO_SIZE) throw new Error("Audio exceeds the 25 MiB transcription limit");
};

export const transcriptionService = {
  async transcribeAttachment(attachment: Attachment, signal?: AbortSignal): Promise<string> {
    checkAudioSize(Number(attachment.size));
    const response = await fetch(getAttachmentUrl(attachment), { signal, credentials: "same-origin" });
    if (!response.ok) throw new Error(`Failed to download audio (${response.status})`);
    checkAudioSize(Number(response.headers.get("Content-Length")));
    const blob = await response.blob();
    checkAudioSize(blob.size);
    return this.transcribeFile(new File([blob], attachment.filename, { type: attachment.type }), signal);
  },

  async transcribeFile(file: File, signal?: AbortSignal): Promise<string> {
    checkAudioSize(file.size);
    signal?.throwIfAborted();
    const content = new Uint8Array(await file.arrayBuffer());
    const response = await aiServiceClient.transcribe(
      create(TranscribeRequestSchema, {
        audio: create(TranscriptionAudioSchema, {
          source: {
            case: "content",
            value: content,
          },
          filename: file.name,
          contentType: file.type,
        }),
      }),
      { signal },
    );

    return response.text;
  },
};
