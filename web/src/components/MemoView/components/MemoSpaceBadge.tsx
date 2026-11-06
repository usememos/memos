import { Badge } from "@usememos/ui";
import SpaceIcon from "@/components/SpaceIcon";
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
      tone="outline"
      title={accessibleLabel}
      className={cn("min-w-0 shrink", showUid && uid ? "max-w-52 sm:max-w-64" : "max-w-36 sm:max-w-48")}
      icon={<SpaceIcon icon={knownSpace?.icon} size={12} />}
    >
      <span className="flex min-w-0 items-baseline overflow-hidden">
        <span className="min-w-0 flex-1 truncate">
          {knownTitle && <span className="mu-visually-hidden">{spaceLabel}: </span>}
          {title}
        </span>
        {showUid && uid ? (
          <>
            <span aria-hidden="true" className="max-w-[48%] shrink-0 truncate font-mono">
              {` · ${formatSpaceUidForDisplay(identityName)}`}
            </span>
            <span className="mu-visually-hidden"> ({uid})</span>
          </>
        ) : null}
      </span>
    </Badge>
  );
};

export default MemoSpaceBadge;
