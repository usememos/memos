import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { aiServiceClient } from "@/connect";
import { TranscribeRequestSchema, TranscriptionAudioSchema } from "@/types/proto/api/v1/ai_service_pb";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { getAttachmentUrl } from "@/utils/attachment";

// Mirrors maxTranscriptionAudioSizeBytes in server/api/v1/ai_service.go so an
// oversized attachment is rejected before it is downloaded, with the server's error.
const MAX_AUDIO_SIZE = 25 * 1024 * 1024;

const checkAudioSize = (size: number) => {
  if (size > MAX_AUDIO_SIZE) throw new ConnectError("audio file is too large; maximum size is 25 MiB", Code.InvalidArgument);
};

const transcribe = async (content: Uint8Array, filename: string, contentType: string, signal?: AbortSignal): Promise<string> => {
  signal?.throwIfAborted();
  const response = await aiServiceClient.transcribe(
    create(TranscribeRequestSchema, {
      audio: create(TranscriptionAudioSchema, {
        source: {
          case: "content",
          value: content,
        },
        filename,
        contentType,
      }),
    }),
    { signal },
  );

  return response.text;
};

export const transcriptionService = {
  async transcribeAttachment(attachment: Attachment, signal?: AbortSignal): Promise<string> {
    checkAudioSize(Number(attachment.size));
    const response = await fetch(getAttachmentUrl(attachment), { signal, credentials: "same-origin" });
    if (!response.ok) throw new Error(`Failed to download audio (${response.status})`);
    checkAudioSize(Number(response.headers.get("Content-Length")));
    const content = new Uint8Array(await response.arrayBuffer());
    checkAudioSize(content.byteLength);
    return transcribe(content, attachment.filename, attachment.type, signal);
  },

  async transcribeFile(file: File, signal?: AbortSignal): Promise<string> {
    return transcribe(new Uint8Array(await file.arrayBuffer()), file.name, file.type, signal);
  },
};
