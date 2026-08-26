import { UserLockIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useSpaceContext } from "@/contexts/SpaceContext";
import { useTranslate } from "@/utils/i18n";

interface MemoSpaceBadgeProps {
  spaceName?: string;
}

const MemoSpaceBadge = ({ spaceName }: MemoSpaceBadgeProps) => {
  const t = useTranslate();
  const { spaces } = useSpaceContext();

  if (!spaceName) return null;

  const spaceLabel = t("space.current");
  const knownTitle = spaces.find((space) => space.name === spaceName)?.title.trim();
  const title = knownTitle || spaceLabel;
  const accessibleLabel = knownTitle ? `${spaceLabel}: ${knownTitle}` : spaceLabel;

  return (
    <Badge
      variant="outline"
      shape="pill"
      title={accessibleLabel}
      className="min-w-0 max-w-24 shrink gap-1 border-border/60 bg-muted/30 px-1.5 py-0 text-[11px] font-normal text-muted-foreground sm:max-w-32"
    >
      <UserLockIcon aria-hidden="true" className="size-3 shrink-0" strokeWidth={1.8} />
      <span className="truncate">
        {knownTitle && <span className="sr-only">{spaceLabel}: </span>}
        {title}
      </span>
    </Badge>
  );
};

export default MemoSpaceBadge;
