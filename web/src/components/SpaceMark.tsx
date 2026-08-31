import { AstroidIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const MARK_SCALE = {
  xl: { mark: "size-11 rounded-lg", icon: "size-6" },
  lg: { mark: "size-9 rounded-[7px]", icon: "size-5" },
  md: { mark: "size-7 rounded-[7px]", icon: "size-4" },
  sm: { mark: "size-5 rounded-[5px]", icon: "size-3" },
} as const;

interface Props {
  size?: keyof typeof MARK_SCALE;
  className?: string;
}

const SpaceMark = ({ size = "md", className }: Props) => {
  const scale = MARK_SCALE[size];

  return (
    <span
      aria-hidden
      className={cn("flex shrink-0 items-center justify-center bg-sidebar-accent text-sidebar-accent-foreground", scale.mark, className)}
    >
      <AstroidIcon className={scale.icon} strokeWidth={1.8} />
    </span>
  );
};

export default SpaceMark;
