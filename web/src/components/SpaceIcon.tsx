import { getSpaceSymbol } from "@/lib/space-icons";
import { cn } from "@/lib/utils";
import type { Space_Icon } from "@/types/proto/api/v1/space_service_pb";

interface Props {
  icon?: Space_Icon;
  className?: string;
}

function SpaceIcon({ icon, className }: Props) {
  if (icon?.value.case === "emoji" && icon.value.value) {
    return (
      <span aria-hidden className={cn("inline-flex shrink-0 items-center justify-center leading-none", className)}>
        {icon.value.value}
      </span>
    );
  }
  const IconComponent = getSpaceSymbol(icon?.value.case === "lucide" ? icon.value.value : "astroid");
  return <IconComponent aria-hidden className={cn("shrink-0", className)} strokeWidth={1.8} />;
}

export default SpaceIcon;
