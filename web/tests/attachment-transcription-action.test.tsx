import { create } from "@bufbuild/protobuf";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import AttachmentListEditor from "@/components/MemoMetadata/Attachment/AttachmentListEditor";
import { AttachmentSchema } from "@/types/proto/api/v1/attachment_service_pb";

const audio = create(AttachmentSchema, { name: "attachments/voice", filename: "voice.wav", type: "audio/wav" });

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }),
  });
});

describe("attachment transcription action", () => {
  it("only offers transcription for persisted audio when the provider is configured", () => {
    const props = {
      attachments: [audio, create(AttachmentSchema, { name: "attachments/document", filename: "document.pdf", type: "application/pdf" })],
    };
    const { rerender } = render(<AttachmentListEditor {...props} />);
    expect(screen.queryByRole("button", { name: "Transcribe" })).not.toBeInTheDocument();
    const onTranscribeAttachment = vi.fn();
    rerender(<AttachmentListEditor {...props} onTranscribeAttachment={onTranscribeAttachment} />);
    expect(screen.getAllByRole("button", { name: "Transcribe" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Transcribe" }));
    expect(onTranscribeAttachment).toHaveBeenCalledExactlyOnceWith(audio);
  });

  it("shows progress, prevents duplicate transcription and preserves the active recording", () => {
    render(
      <AttachmentListEditor
        attachments={[audio]}
        onTranscribeAttachment={vi.fn()}
        transcribingAttachment={audio.name}
        onAttachmentsChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Transcribing..." })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Remove attachment" })).not.toBeInTheDocument();
    expect(screen.getByText("voice.wav")).toBeInTheDocument();
  });

  it("does not offer transcription for externally linked audio", () => {
    const linked = create(AttachmentSchema, { ...audio, name: "attachments/linked", externalLink: "https://example.com/voice.wav" });
    render(<AttachmentListEditor attachments={[linked]} onTranscribeAttachment={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Transcribe" })).not.toBeInTheDocument();
  });

  it("disables transcription while the editor is saving or recording", () => {
    render(<AttachmentListEditor attachments={[audio]} onTranscribeAttachment={vi.fn()} transcriptionDisabled />);
    expect(screen.getByRole("button", { name: "Transcribe" })).toBeDisabled();
  });
});
