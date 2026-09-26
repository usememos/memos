import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { act, renderHook } from "@testing-library/react";
import { toast } from "react-hot-toast";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAttachmentTranscription } from "@/components/MemoEditor/hooks/useAttachmentTranscription";
import { transcriptionService } from "@/components/MemoEditor/services";
import { AttachmentSchema } from "@/types/proto/api/v1/attachment_service_pb";

vi.mock("react-hot-toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
const audio = create(AttachmentSchema, { name: "attachments/voice", filename: "voice.wav", type: "audio/wav" });
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("attachment transcription lifecycle", () => {
  it("inserts trimmed text once, keeping the attachment unchanged and rejecting concurrent requests", async () => {
    const pending = Promise.withResolvers<string>();
    const transcribe = vi.spyOn(transcriptionService, "transcribeAttachment").mockReturnValue(pending.promise);
    const onText = vi.fn();
    const original = create(AttachmentSchema, audio);
    const { result } = renderHook(() => useAttachmentTranscription(onText));
    let completion: Promise<void>;
    act(() => {
      completion = result.current.transcribeAttachment(audio);
    });
    expect(result.current.transcribingAttachment).toBe(audio.name);
    await act(() => result.current.transcribeAttachment(audio));
    expect(transcribe).toHaveBeenCalledTimes(1);
    await act(async () => {
      pending.resolve("  Meeting notes  ");
      await completion;
    });
    expect(onText).toHaveBeenCalledExactlyOnceWith("Meeting notes");
    expect(audio).toEqual(original);
    expect(result.current.transcribingAttachment).toBeUndefined();
  });

  it.each(["", "  "])("leaves the draft unchanged on an empty transcript", async (text) => {
    vi.spyOn(transcriptionService, "transcribeAttachment").mockResolvedValue(text);
    const onText = vi.fn();
    const { result } = renderHook(() => useAttachmentTranscription(onText));
    await act(() => result.current.transcribeAttachment(audio));
    expect(onText).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("No speech detected");
    expect(result.current.transcribingAttachment).toBeUndefined();
  });

  it("allows retry after a provider failure without modifying the draft", async () => {
    vi.spyOn(transcriptionService, "transcribeAttachment")
      .mockRejectedValueOnce(new ConnectError("Provider unavailable", Code.Unavailable))
      .mockResolvedValueOnce("Retry works");
    const onText = vi.fn();
    const { result } = renderHook(() => useAttachmentTranscription(onText));
    await act(() => result.current.transcribeAttachment(audio));
    expect(onText).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Provider unavailable");
    expect(result.current.transcribingAttachment).toBeUndefined();
    await act(() => result.current.transcribeAttachment(audio));
    expect(onText).toHaveBeenCalledExactlyOnceWith("Retry works");
  });

  it("reports download and network failures with the translated fallback", async () => {
    vi.spyOn(transcriptionService, "transcribeAttachment").mockRejectedValue(new TypeError("Failed to fetch"));
    const onText = vi.fn();
    const { result } = renderHook(() => useAttachmentTranscription(onText));
    await act(() => result.current.transcribeAttachment(audio));
    expect(onText).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Failed to transcribe audio");
    expect(result.current.transcribingAttachment).toBeUndefined();
  });

  it("cancels on editor unmount and ignores a late transcript", async () => {
    const pending = Promise.withResolvers<string>();
    const transcribe = vi.spyOn(transcriptionService, "transcribeAttachment").mockReturnValue(pending.promise);
    const onText = vi.fn();
    const { result, unmount } = renderHook(() => useAttachmentTranscription(onText));
    let completion: Promise<void>;
    act(() => {
      completion = result.current.transcribeAttachment(audio);
    });
    const signal = transcribe.mock.calls[0][1];
    unmount();
    expect(signal?.aborted).toBe(true);
    await act(async () => {
      pending.resolve("Late result");
      await completion;
    });
    expect(onText).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
