import { LoaderIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  size?: "sm" | "md" | "lg";
}

const Spinner = ({ className, size = "md" }: Props) => {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };

  return <LoaderIcon className={cn("animate-spin", sizeClasses[size], className)} />;
};

export default Spinner;
