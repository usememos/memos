// filepath: /Users/yuxuanli/Desktop/Project/Knowledge-Tree/web/src/components/MemoEditor/components/AddVideoLinkDialog.tsx

import { CheckCircle2, VideoIcon, XCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  getProviderColor,
  getProviderDisplayName,
  parseVideoUrl,
  type VideoLinkInfo,
} from "@/components/attachment/utils/videoLinkResolver";

interface AddVideoLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (info: VideoLinkInfo) => void;
}

export function AddVideoLinkDialog({ open, onOpenChange, onConfirm }: AddVideoLinkDialogProps) {
  const [url, setUrl] = useState("");

  const videoInfo = url.trim() ? parseVideoUrl(url) : null;
  const isValid = videoInfo !== null;

  const handleConfirm = () => {
    if (videoInfo) {
      onConfirm(videoInfo);
      setUrl("");
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    setUrl("");
    onOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && isValid) {
      e.preventDefault();
      handleConfirm();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <VideoIcon className="w-5 h-5" />
            Add Video Link
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Input
              placeholder="Paste video URL (YouTube, Bilibili, Vimeo...)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />

            {/* Validation feedback */}
            {url.trim() && (
              <div className="flex items-center gap-2 text-sm">
                {isValid ? (
                  <>
                    <CheckCircle2 className={`w-4 h-4 ${getProviderColor(videoInfo.provider)}`} />
                    <span className="text-muted-foreground">
                      Detected: <span className="font-medium">{getProviderDisplayName(videoInfo.provider)}</span>
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-destructive" />
                    <span className="text-destructive">Unsupported URL. Supported: YouTube, Bilibili, Vimeo</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Preview thumbnail for YouTube */}
          {videoInfo?.thumbnailUrl && (
            <div className="relative rounded-lg overflow-hidden bg-muted aspect-video">
              <img
                src={videoInfo.thumbnailUrl}
                alt="Video thumbnail"
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Hide if thumbnail fails to load
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center">
                  <div className="w-0 h-0 border-t-[8px] border-t-transparent border-l-[14px] border-l-white border-b-[8px] border-b-transparent ml-1" />
                </div>
              </div>
            </div>
          )}

          {/* Supported providers hint */}
          <p className="text-xs text-muted-foreground">
            Supported platforms: YouTube, Bilibili, Vimeo. The video will be embedded inline for preview.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!isValid}>
            Add Video
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
