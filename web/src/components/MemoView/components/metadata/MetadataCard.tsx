import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MetadataCardProps {
  children: ReactNode;
  className?: string;
}

const MetadataCard = ({ children, className }: MetadataCardProps) => {
  return (
    <div
      className={cn(
        "relative flex flex-col justify-start items-start w-full px-2 pt-2 pb-1.5 bg-muted/50 rounded-lg border border-border",
        className,
      )}
    >
      {children}
    </div>
  );
};

export default MetadataCard;
