import { create } from "@bufbuild/protobuf";
import { aiServiceClient } from "@/connect";
import { TranscribeRequestSchema, TranscriptionAudioSchema, TranscriptionConfigSchema } from "@/types/proto/api/v1/ai_service_pb";
import type { InstanceSetting_AIProviderConfig } from "@/types/proto/api/v1/instance_service_pb";

export const transcriptionService = {
  async transcribeFile(file: File, provider: InstanceSetting_AIProviderConfig): Promise<string> {
    const content = new Uint8Array(await file.arrayBuffer());
    const response = await aiServiceClient.transcribe(
      create(TranscribeRequestSchema, {
        providerId: provider.id,
        config: create(TranscriptionConfigSchema, {}),
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
