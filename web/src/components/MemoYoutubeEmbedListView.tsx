import { memo } from "react";
import { cn } from "@/lib/utils";

interface Props {
  videoIds: string[];
}

const MemoYoutubeEmbedListView: React.FC<Props> = ({ videoIds }: Props) => {
  if (!videoIds || videoIds.length === 0) {
    return null;
  }

  const EmbedCard = ({ videoId, className }: { videoId: string; className?: string }) => {
    return (
      <div className={cn("relative w-full", className)}>
        <div className="relative w-full pt-[56.25%] rounded-lg overflow-hidden border border-border/60 bg-popover">
          <iframe
            className="absolute top-0 left-0 w-full h-full"
            src={`https://www.youtube.com/embed/${videoId}`}
            title="YouTube video player"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </div>
    );
  };

  return (
    <div className="w-full flex flex-row justify-start overflow-auto gap-2">
      {videoIds.map((id) => (
        <div key={id} className="w-80 flex flex-col justify-start items-start shrink-0">
          <EmbedCard videoId={id} className="max-h-64 grow" />
        </div>
      ))}
    </div>
  );
};

export default memo(MemoYoutubeEmbedListView);
