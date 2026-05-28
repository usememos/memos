import { create } from "@bufbuild/protobuf";
import { aiServiceClient } from "@/connect";
import { TranscribeRequestSchema, TranscriptionAudioSchema } from "@/types/proto/api/v1/ai_service_pb";

export const transcriptionService = {
  async transcribeFile(file: File): Promise<string> {
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
    );

    return response.text;
  },
};
