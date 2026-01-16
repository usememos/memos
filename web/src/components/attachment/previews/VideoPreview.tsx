import { useState } from "react";

interface VideoPreviewProps {
  src: string;
  type: string;
  isLoading?: boolean;
}

export function VideoPreview({ src, type, isLoading }: VideoPreviewProps) {
  const [error, setError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <p>Failed to load video</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full bg-black">
      <video src={src} controls autoPlay={false} className="max-w-full max-h-full" onError={() => setError("Video format not supported")}>
        <source src={src} type={type} />
        Your browser does not support the video tag.
      </video>
    </div>
  );
}
