import { AstroidIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useSpaceContext } from "@/contexts/SpaceContext";
import { extractSpaceUidFromName, formatSpaceUidForDisplay } from "@/lib/space-display";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";

interface MemoSpaceBadgeProps {
  spaceName?: string;
}

const MemoSpaceBadge = ({ spaceName }: MemoSpaceBadgeProps) => {
  const t = useTranslate();
  const { duplicateSpaceTitles, spaceByName } = useSpaceContext();

  if (!spaceName) return null;

  const spaceLabel = t("space.current");
  const knownSpace = spaceByName.get(spaceName);
  const knownTitle = knownSpace?.title.trim();
  const identityName = knownSpace?.name ?? spaceName;
  const uid = extractSpaceUidFromName(identityName);
  const title = knownTitle || spaceLabel;
  const showUid = !knownSpace || !knownTitle || duplicateSpaceTitles.has(knownSpace.title);
  const accessibleLabel = `${knownTitle ? `${spaceLabel}: ${knownTitle}` : spaceLabel}${showUid && uid ? ` (${uid})` : ""}`;

  return (
    <Badge
      variant="outline"
      shape="pill"
      title={accessibleLabel}
      className={cn(
        "min-w-0 shrink gap-1 border-border/60 bg-muted/30 px-1.5 py-0 text-[11px] font-normal text-muted-foreground",
        showUid && uid ? "max-w-52 sm:max-w-64" : "max-w-36 sm:max-w-48",
      )}
    >
      <AstroidIcon aria-hidden="true" className="size-3 shrink-0" strokeWidth={1.8} />
      <span className="flex min-w-0 items-baseline overflow-hidden">
        <span className="min-w-0 flex-1 truncate">
          {knownTitle && <span className="sr-only">{spaceLabel}: </span>}
          {title}
        </span>
        {showUid && uid ? (
          <>
            <span aria-hidden="true" className="max-w-[48%] shrink-0 truncate font-mono">
              {` · ${formatSpaceUidForDisplay(identityName)}`}
            </span>
            <span className="sr-only"> ({uid})</span>
          </>
        ) : null}
      </span>
    </Badge>
  );
};

export default MemoSpaceBadge;
