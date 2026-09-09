import { AstroidIcon, type LucideIcon } from "lucide-react";
import type { CustomIconValue } from "@/lib/custom-icons";
import { getCustomSymbol } from "@/lib/custom-icons";
import { cn } from "@/lib/utils";

interface Props {
  icon?: CustomIconValue;
  className?: string;
  fallback?: LucideIcon;
}

function CustomIcon({ icon, className, fallback = AstroidIcon }: Props) {
  if (icon?.value.case === "emoji" && icon.value.value) {
    return (
      <span aria-hidden className={cn("inline-flex shrink-0 items-center justify-center leading-none", className)}>
        {icon.value.value}
      </span>
    );
  }
  const IconComponent = getCustomSymbol(icon?.value.case === "lucide" ? icon.value.value : "", fallback);
  return <IconComponent aria-hidden className={cn("shrink-0", className)} strokeWidth={1.8} />;
}

export default CustomIcon;
