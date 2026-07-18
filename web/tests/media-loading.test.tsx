import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Image } from "@/components/MemoContent/markdown/Image";
import AudioAttachmentItem from "@/components/MemoMetadata/Attachment/AudioAttachmentItem";
import MotionPhotoPlayer from "@/components/MotionPhotoPlayer";

describe("media loading", () => {
  it("marks markdown images for native lazy loading", () => {
    render(<Image src="/image.jpg" alt="memo illustration" />);

    const image = screen.getByRole("img", { name: "memo illustration" });
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image).toHaveAttribute("decoding", "async");
  });

  it("does not bind an audio source until playback is requested", async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    const { container } = render(
      <AudioAttachmentItem filename="recording.mp3" sourceUrl="/recording.mp3" mimeType="audio/mpeg" />,
    );
    const audio = container.querySelector("audio");

    expect(audio).not.toHaveAttribute("src");
    expect(audio).toHaveAttribute("preload", "none");

    fireEvent.click(screen.getByRole("button", { name: "Play recording.mp3" }));

    expect(audio).toHaveAttribute("src", "/recording.mp3");
    expect(play).toHaveBeenCalledOnce();
  });

  it("defers binding the motion video until first activation, then keeps it for replays", () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});

    const { container, rerender } = render(
      <MotionPhotoPlayer posterUrl="/poster.jpg" motionUrl="/motion.mp4" alt="Live photo" active={false} />,
    );
    const video = container.querySelector("video");

    expect(video).not.toHaveAttribute("src");
    expect(video).toHaveAttribute("preload", "none");

    rerender(<MotionPhotoPlayer posterUrl="/poster.jpg" motionUrl="/motion.mp4" alt="Live photo" active />);
    expect(video).toHaveAttribute("src", "/motion.mp4");

    // Deactivating pauses playback but keeps the buffered source bound.
    rerender(<MotionPhotoPlayer posterUrl="/poster.jpg" motionUrl="/motion.mp4" alt="Live photo" active={false} />);
    expect(pause).toHaveBeenCalled();
    expect(video).toHaveAttribute("src", "/motion.mp4");
  });
});
