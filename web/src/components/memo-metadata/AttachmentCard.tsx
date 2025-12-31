import { cn } from "@/lib/utils";
import type { AttachmentItem } from "./types";

interface AttachmentCardProps {
  item: AttachmentItem;
  mode: "view";
  onClick?: () => void;
  className?: string;
}

const AttachmentCard = ({ item, onClick, className }: AttachmentCardProps) => {
  const { category, filename, sourceUrl } = item;

  if (category === "image") {
    return (
      <img
        src={sourceUrl}
        alt={filename}
        className={cn("w-full h-full object-cover rounded-lg cursor-pointer", className)}
        onClick={onClick}
        loading="lazy"
      />
    );
  }

  if (category === "video") {
    return <video src={sourceUrl} className={cn("w-full h-full object-cover rounded-lg", className)} controls preload="metadata" />;
  }

  return null;
};

export default AttachmentCard;
