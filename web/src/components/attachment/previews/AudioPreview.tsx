import { Music } from "lucide-react";

interface AudioPreviewProps {
  src: string;
  filename: string;
  type: string;
  isLoading?: boolean;
}

export function AudioPreview({ src, filename, type, isLoading }: AudioPreviewProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 p-8">
      {/* Album art placeholder */}
      <div className="w-48 h-48 bg-gradient-to-br from-primary/20 to-primary/40 rounded-2xl flex items-center justify-center shadow-lg">
        <Music className="w-24 h-24 text-primary/60" />
      </div>

      {/* Filename */}
      <p className="text-lg font-medium text-foreground text-center max-w-md truncate">{filename}</p>

      {/* Audio player */}
      <audio src={src} controls className="w-full max-w-md">
        <source src={src} type={type} />
        Your browser does not support the audio element.
      </audio>
    </div>
  );
}
