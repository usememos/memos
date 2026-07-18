import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import VideoPoster from "@/components/VideoPoster";

describe("<VideoPoster>", () => {
  let intersectionCallback: IntersectionObserverCallback;

  beforeEach(() => {
    class IntersectionObserverMock implements IntersectionObserver {
      readonly root = null;
      readonly rootMargin = "200px 0px";
      readonly thresholds = [0];

      constructor(callback: IntersectionObserverCallback) {
        intersectionCallback = callback;
      }

      disconnect = vi.fn();
      observe = vi.fn();
      takeRecords = vi.fn(() => []);
      unobserve = vi.fn();
    }

    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const enterViewport = () => {
    act(() => {
      intersectionCallback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
  };

  it("waits until the poster is near the viewport before loading video data", () => {
    render(<VideoPoster sourceUrl="/file/attachments/video/video.mp4" alt="clip.mp4" className="object-cover" />);

    expect(screen.getByTestId("video-poster-placeholder")).toBeInTheDocument();
    expect(screen.queryByTestId("video-poster-fallback")).not.toBeInTheDocument();

    enterViewport();

    const video = screen.getByTestId("video-poster-fallback");
    expect(video).toHaveAttribute("src", "/file/attachments/video/video.mp4#t=0.001");
    expect(video).toHaveAttribute("preload", "auto");
    expect(video).toHaveAttribute("playsinline");
    expect((video as HTMLVideoElement).muted).toBe(true);
    expect(video).toHaveClass("object-cover");
  });

  it("renders a captured frame as an image poster", async () => {
    const drawImage = vi.fn();
    const toDataURL = vi.fn(() => "data:image/jpeg;base64,poster");
    const originalCreateElement = document.createElement.bind(document);

    vi.spyOn(document, "createElement").mockImplementation((tagName: string, options?: ElementCreationOptions) => {
      if (tagName === "canvas") {
        return {
          width: 0,
          height: 0,
          getContext: vi.fn(() => ({ drawImage })),
          toDataURL,
        } as unknown as HTMLCanvasElement;
      }

      return originalCreateElement(tagName, options);
    });

    render(<VideoPoster sourceUrl="/file/attachments/video/video.mp4" alt="clip.mp4" className="object-cover" />);
    enterViewport();

    const video = screen.getByTestId("video-poster-fallback") as HTMLVideoElement;
    Object.defineProperty(video, "videoWidth", { configurable: true, value: 640 });
    Object.defineProperty(video, "videoHeight", { configurable: true, value: 360 });

    fireEvent.loadedData(video);

    await waitFor(() => {
      expect(screen.getByRole("img", { name: "clip.mp4" })).toHaveAttribute("src", "data:image/jpeg;base64,poster");
    });
    expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 640, 360);
  });

  it("uses an available poster without loading the video fallback", () => {
    render(
      <VideoPoster
        sourceUrl="/file/attachments/video/video.mp4"
        posterUrl="/file/attachments/video/poster.webp"
        alt="clip.mp4"
      />,
    );

    expect(screen.getByRole("img", { name: "clip.mp4" })).toHaveAttribute("src", "/file/attachments/video/poster.webp");
    expect(screen.queryByTestId("video-poster-fallback")).not.toBeInTheDocument();
  });
});
