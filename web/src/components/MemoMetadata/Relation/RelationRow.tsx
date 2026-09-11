import { LinkIcon, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { createMemoNavigationState } from "@/components/MemoView/navigation";
import type { MemoRelation_Memo } from "@/types/proto/api/v1/memo_service_pb";
import { METADATA_ROW_CLASSES, METADATA_ROW_LABEL_CLASSES, METADATA_ROW_TEXT_CLASSES, MetadataRowIconSlot } from "../MetadataSection";

interface RelationRowProps {
  memo: MemoRelation_Memo;
  parentPage?: string;
  icon?: LucideIcon;
  /**
   * "row" is a complete row that is its own focus target; "label" is the focusable body
   * of a row whose box is a wrapper carrying other controls (the editor's remove button).
   */
  variant?: "row" | "label";
  /** Detail on the trailing rail, such as the relation's direction. */
  trailing?: ReactNode;
}

/** One related memo as a metadata row: a glyph in the leading slot and the snippet. */
const RelationRow = ({ memo, parentPage, icon = LinkIcon, variant = "row", trailing }: RelationRowProps) => (
  <Link
    className={variant === "row" ? METADATA_ROW_CLASSES : METADATA_ROW_LABEL_CLASSES}
    to={`/${memo.name}`}
    state={parentPage ? createMemoNavigationState(parentPage) : undefined}
    viewTransition
  >
    <MetadataRowIconSlot icon={icon} />
    <span className={METADATA_ROW_TEXT_CLASSES}>{memo.snippet || <span className="italic text-muted-foreground/60">No content</span>}</span>
    {trailing}
  </Link>
);

export default RelationRow;
