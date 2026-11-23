import { Skeleton } from "@usememos/ui";
import { CircleSlashIcon, CornerUpLeftIcon } from "lucide-react";
import { Link } from "react-router-dom";
import {
  METADATA_COMPACT_ROW_CLASSES,
  METADATA_ROW_LIST_CLASSES,
  METADATA_ROW_TEXT_CLASSES,
} from "@/components/MemoMetadata/MetadataSection";
import { useAuth } from "@/contexts/AuthContext";
import { useMemoLookup } from "@/hooks/useMemoQueries";
import { useNearViewport } from "@/hooks/useNearViewport";
import { extractMemoIdFromName } from "@/lib/resource-names";
import { isMemoBlurred } from "@/lib/tag";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { useMemoViewContext } from "../MemoViewContext";
import { createMemoNavigationState } from "../navigation";

/** The compact row's box without its hover wash, for a line that is not a link. */
const STATIC_ROW_CLASSES = "flex h-6 w-full min-w-0 items-center gap-1 border border-transparent px-2 mu-caption text-mu-text-secondary";
/**
 * The glyph starts on the card's text edge, level with the time and the body under it. The
 * sidebar's 20px slot would center it 5px to the right of that edge, and this strip has no
 * avatar column to share a rail with; the 2px pull-back is the glyph's own inner margin.
 */
const GLYPH_SLOT_CLASSES = "-ms-0.5 flex h-5 w-3.5 shrink-0 items-center justify-center";

/** One line for the parent: its title when it has one, otherwise the start of its text. */
const parentLine = (title: string | undefined, text: string): string => title?.trim() || text.replace(/\s+/g, " ").trim();

/**
 * The parent strip hangs off the top edge of a comment's card wherever the comment is shown
 * away from its thread: one muted line naming the memo it comments on, linking to that memo
 * at this comment. It mirrors the comment strip that hangs off the bottom of a memo's card,
 * and it holds its height while the parent loads so the card does not move.
 */
const MemoParentStripView: React.FC = () => {
  const t = useTranslate();
  const { memo, parentPage } = useMemoViewContext();
  const { userTagsSetting } = useAuth();
  const { ref: viewportRef, isNearViewport } = useNearViewport<HTMLElement>();
  const parentName = memo.parent ?? "";
  const { data: parent, isUnavailable, error } = useMemoLookup(parentName, { enabled: isNearViewport && parentName !== "" });

  const label = t("memo.parent-memo");
  let row: React.ReactNode;
  if (parent) {
    // A parent whose tags blur it is named, not quoted.
    const text = isMemoBlurred(parent, userTagsSetting)
      ? label
      : parentLine(parent.property?.title, parent.snippet || parent.content) || label;
    row = (
      <Link
        to={`/${parent.name}#${extractMemoIdFromName(memo.name)}`}
        state={createMemoNavigationState(parentPage)}
        viewTransition
        title={text}
        aria-label={text === label ? label : `${label}: ${text}`}
        className={METADATA_COMPACT_ROW_CLASSES}
      >
        <span className={GLYPH_SLOT_CLASSES} aria-hidden="true">
          <CornerUpLeftIcon className="mu-icon-sm rtl:-scale-x-100" />
        </span>
        <span className={METADATA_ROW_TEXT_CLASSES}>{text}</span>
      </Link>
    );
  } else if (isUnavailable || error) {
    row = (
      <div className={STATIC_ROW_CLASSES}>
        <span className={GLYPH_SLOT_CLASSES} aria-hidden="true">
          <CircleSlashIcon className="mu-icon-sm" />
        </span>
        <span className={METADATA_ROW_TEXT_CLASSES}>{t("memo.parent-unavailable")}</span>
      </div>
    );
  } else {
    row = (
      <div className={STATIC_ROW_CLASSES} role="status" aria-label={t("memo.parent-loading")}>
        <span className={GLYPH_SLOT_CLASSES} aria-hidden="true">
          <CornerUpLeftIcon className="mu-icon-sm rtl:-scale-x-100" />
        </span>
        <Skeleton width={160} height={8} />
      </div>
    );
  }

  return (
    <section ref={viewportRef} aria-label={label} className="rounded-t-mu-lg border border-b-0 border-mu-line/70 px-4 py-1">
      <div className={cn(METADATA_ROW_LIST_CLASSES, "min-h-6 gap-0")}>{row}</div>
    </section>
  );
};

export default MemoParentStripView;
