import { LinkIcon, MilestoneIcon } from "lucide-react";
import { useMemo } from "react";
import type { MemoRelation } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { METADATA_ROW_DETAIL_CLASSES } from "../MetadataSection";
import RelationRow from "./RelationRow";
import { getRelationBuckets, getRelationMemo, getRelationMemoName, type RelationDirection } from "./relationHelpers";
import { useResolvedRelationMemos } from "./useResolvedRelationMemos";

export interface RelationRowItem {
  relation: MemoRelation;
  direction: RelationDirection;
}

/** Every reference to or from the memo, referencing first, as rows in one list. */
export const getRelationRowItems = (relations: MemoRelation[], currentMemoName?: string): RelationRowItem[] => {
  const { referencing, referenced } = getRelationBuckets(relations, currentMemoName);
  return [
    ...referencing.map((relation) => ({ relation, direction: "referencing" as const })),
    ...referenced.map((relation) => ({ relation, direction: "referenced" as const })),
  ];
};

const DIRECTION_ICONS = { referencing: LinkIcon, referenced: MilestoneIcon } as const;

interface RelationRowsProps {
  items: RelationRowItem[];
  parentPage?: string;
  /** Resolve fresh snippets only once the rows are near the viewport. */
  enabled: boolean;
}

/**
 * Related memos are rows like the memo's files: a direction glyph in the slot, the
 * snippet, and the direction spelled out on the detail rail. No header or tabs, so the
 * list reads as part of the memo rather than a panel attached to it.
 */
const RelationRows = ({ items, parentPage, enabled }: RelationRowsProps) => {
  const t = useTranslate();
  const memoNames = useMemo(
    () =>
      items.flatMap(({ relation, direction }) => {
        const memo = getRelationMemo(relation, direction);
        return memo?.name ? [memo.name] : [];
      }),
    [items],
  );
  const resolvedMemos = useResolvedRelationMemos(memoNames, { enabled });
  const directionLabels: Record<RelationDirection, string> = {
    referencing: t("common.referencing"),
    referenced: t("common.referenced-by"),
  };

  return (
    <>
      {items.map(({ relation, direction }) => {
        const memo = getRelationMemo(relation, direction);
        if (!memo || resolvedMemos[memo.name] === null) {
          return null;
        }
        return (
          <RelationRow
            key={getRelationMemoName(relation, direction)}
            memo={resolvedMemos[memo.name] ?? memo}
            parentPage={parentPage}
            icon={DIRECTION_ICONS[direction]}
            trailing={<span className={METADATA_ROW_DETAIL_CLASSES}>{directionLabels[direction]}</span>}
          />
        );
      })}
    </>
  );
};

export default RelationRows;
