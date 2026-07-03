import { create, fromJsonString } from "@bufbuild/protobuf";
import { Code, ConnectError, type ConnectRouter } from "@connectrpc/connect";
import { AIService, TranscribeResponseSchema } from "../gen/api/v1/ai_service_pb";
import {
  InstanceSetting_AIProviderType,
  InstanceSetting_AISettingSchema,
  type InstanceSetting_AISetting,
} from "../gen/api/v1/instance_service_pb";
import { getInstanceSetting } from "../store/settings";
import type { ServiceContext } from "./context";
import { requireUser } from "./context";

const MAX_AUDIO_BYTES = 25 << 20;
const SUPPORTED_TYPES = ["audio/webm", "audio/mp4", "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg", "video/webm", "video/mp4"];

async function loadAISetting(ctx: ServiceContext): Promise<InstanceSetting_AISetting> {
  const row = await getInstanceSetting(ctx.env.DB, "AI");
  return row ? fromJsonString(InstanceSetting_AISettingSchema, row.value, { ignoreUnknownFields: true }) : create(InstanceSetting_AISettingSchema);
}

// Unlike the Go server, no server-side WebM/Opus conversion is needed:
// OpenAI and Gemini both accept webm audio directly.
export function registerAIService(router: ConnectRouter, ctx: ServiceContext): void {
  router.service(AIService, {
    async transcribe(request) {
      requireUser(ctx);
      const audio = request.audio;
      if (!audio || audio.source.case !== "content" || audio.source.value.byteLength === 0) {
        throw new ConnectError("audio content is required", Code.InvalidArgument);
      }
      const content = audio.source.value;
      if (content.byteLength > MAX_AUDIO_BYTES) {
        throw new ConnectError("audio file is too large; maximum size is 25 MiB", Code.InvalidArgument);
      }
      const contentType = audio.contentType || "audio/webm";
      if (!SUPPORTED_TYPES.some((t) => contentType.startsWith(t))) {
        throw new ConnectError(`unsupported audio content type: ${contentType}`, Code.InvalidArgument);
      }

      const setting = await loadAISetting(ctx);
      const provider =
        setting.providers.find((p) => p.id === setting.transcription?.providerId) ?? setting.providers[0];
      if (!provider) {
        throw new ConnectError("no AI provider configured", Code.FailedPrecondition);
      }
      const transcription = setting.transcription;

      if (provider.type === InstanceSetting_AIProviderType.GEMINI) {
        const apiKey = provider.apiKey || ctx.env.GEMINI_API_KEY;
        if (!apiKey) {
          throw new ConnectError("Gemini API key is not configured", Code.FailedPrecondition);
        }
        const model = transcription?.model || "gemini-2.0-flash";
        const endpoint = provider.endpoint || "https://generativelanguage.googleapis.com";
        const prompt = transcription?.prompt || "Transcribe this audio verbatim. Output only the transcription text.";
        const response = await fetch(`${endpoint}/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  { inline_data: { mime_type: contentType, data: base64Encode(content) } },
                ],
              },
            ],
          }),
          signal: AbortSignal.timeout(120_000),
        });
        if (!response.ok) {
          throw new ConnectError(`transcription failed: ${response.status} ${await response.text()}`, Code.Internal);
        }
        const result = (await response.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
        const text = result.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
        return create(TranscribeResponseSchema, { text: text.trim() });
      }

      // OPENAI (default)
      const apiKey = provider.apiKey || ctx.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new ConnectError("OpenAI API key is not configured", Code.FailedPrecondition);
      }
      const endpoint = provider.endpoint || "https://api.openai.com/v1";
      const form = new FormData();
      const contentCopy = new Uint8Array(content).buffer;
      form.append("file", new Blob([contentCopy], { type: contentType }), audio.filename || "audio.webm");
      form.append("model", transcription?.model || "whisper-1");
      if (transcription?.language) {
        form.append("language", transcription.language);
      }
      if (transcription?.prompt) {
        form.append("prompt", transcription.prompt);
      }
      const response = await fetch(`${endpoint}/audio/transcriptions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok) {
        throw new ConnectError(`transcription failed: ${response.status} ${await response.text()}`, Code.Internal);
      }
      const result = (await response.json()) as { text?: string };
      return create(TranscribeResponseSchema, { text: (result.text ?? "").trim() });
    },
  });
}

function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
