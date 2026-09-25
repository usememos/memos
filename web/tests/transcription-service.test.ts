import { create } from "@bufbuild/protobuf";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AttachmentSchema } from "@/types/proto/api/v1/attachment_service_pb";

const { transcribe } = vi.hoisted(() => ({ transcribe: vi.fn() }));
vi.mock("@/connect", () => ({ aiServiceClient: { transcribe } }));

import { transcriptionService } from "@/components/MemoEditor/services/transcriptionService";

const audio = create(AttachmentSchema, { name: "attachments/voice", filename: "voice.wav", type: "audio/wav", size: 3n });

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  transcribe.mockReset();
});

describe("existing audio transcription", () => {
  it("downloads authenticated audio and sends its bytes and metadata to the configured AI service", async () => {
    const response = new Response();
    // Keep the downloaded Blob and browser File in the same jsdom realm.
    vi.spyOn(response, "blob").mockResolvedValue(new Blob(["abc"]));
    const fetchAudio = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchAudio);
    transcribe.mockResolvedValue({ text: "Meeting notes" });
    const controller = new AbortController();

    await expect(transcriptionService.transcribeAttachment(audio, controller.signal)).resolves.toBe("Meeting notes");

    expect(fetchAudio).toHaveBeenCalledWith(`${window.location.origin}/file/attachments/voice/voice.wav`, {
      credentials: "same-origin",
      signal: controller.signal,
    });
    expect(transcribe).toHaveBeenCalledWith(
      expect.objectContaining({
        audio: expect.objectContaining({
          filename: "voice.wav",
          contentType: "audio/wav",
          source: { case: "content", value: new Uint8Array([97, 98, 99]) },
        }),
      }),
      { signal: controller.signal },
    );
  });

  it("does not send download failures to the AI provider", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 403 })));
    await expect(transcriptionService.transcribeAttachment(audio)).rejects.toThrow("403");
    expect(transcribe).not.toHaveBeenCalled();
  });

  it("rejects oversized metadata before downloading", async () => {
    const fetchAudio = vi.fn();
    vi.stubGlobal("fetch", fetchAudio);
    await expect(transcriptionService.transcribeAttachment(create(AttachmentSchema, { ...audio, size: 26214401n }))).rejects.toThrow(
      "25 MiB",
    );
    expect(fetchAudio).not.toHaveBeenCalled();
  });

  it("rejects oversized download headers before reading the body", async () => {
    const response = new Response(null, { headers: { "Content-Length": "26214401" } });
    const read = vi.spyOn(response, "blob");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    await expect(transcriptionService.transcribeAttachment(audio)).rejects.toThrow("25 MiB");
    expect(read).not.toHaveBeenCalled();
    expect(transcribe).not.toHaveBeenCalled();
  });

  it("checks actual body size when the server omits Content-Length", async () => {
    const blob = new Blob(["abc"]);
    Object.defineProperty(blob, "size", { value: 26214401 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, headers: new Headers(), blob: async () => blob }));
    await expect(transcriptionService.transcribeAttachment(audio)).rejects.toThrow("25 MiB");
    expect(transcribe).not.toHaveBeenCalled();
  });

  it("does not start a transcription after cancellation", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(transcriptionService.transcribeFile(new File(["abc"], "voice.wav"), controller.signal)).rejects.toThrow();
    expect(transcribe).not.toHaveBeenCalled();
  });
});
