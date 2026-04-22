import { LinkIcon, MilestoneIcon } from "lucide-react";
import { useMemo, useState } from "react";
import MetadataSection from "@/components/MemoMetadata/MetadataSection";
import type { MemoRelation } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import RelationCard from "./RelationCard";
import { getRelationBuckets, getRelationMemo, getRelationMemoName, type RelationDirection } from "./relationHelpers";
import { useResolvedRelationMemos } from "./useResolvedRelationMemos";

interface RelationListViewProps {
  relations: MemoRelation[];
  currentMemoName?: string;
  parentPage?: string;
  className?: string;
}

function RelationListView({ relations, currentMemoName, parentPage, className }: RelationListViewProps) {
  const t = useTranslate();
  const [activeTab, setActiveTab] = useState<"referencing" | "referenced">("referencing");
  const resolvedMemos = useResolvedRelationMemos(relations);

  const { referencing: referencingRelations, referenced: referencedRelations } = useMemo(
    () => getRelationBuckets(relations, currentMemoName),
    [relations, currentMemoName],
  );

  if (referencingRelations.length === 0 && referencedRelations.length === 0) {
    return null;
  }

  const hasBothTabs = referencingRelations.length > 0 && referencedRelations.length > 0;
  const direction: RelationDirection = hasBothTabs ? activeTab : referencingRelations.length > 0 ? "referencing" : "referenced";
  const isReferencing = direction === "referencing";
  const icon = isReferencing ? LinkIcon : MilestoneIcon;
  const activeRelations = isReferencing ? referencingRelations : referencedRelations;

  return (
    <MetadataSection
      className={className}
      icon={icon}
      title={isReferencing ? t("common.referencing") : t("common.referenced-by")}
      count={activeRelations.length}
      tabs={
        hasBothTabs
          ? [
              {
                id: "referencing",
                label: t("common.referencing"),
                count: referencingRelations.length,
                active: isReferencing,
                onClick: () => setActiveTab("referencing"),
              },
              {
                id: "referenced",
                label: t("common.referenced-by"),
                count: referencedRelations.length,
                active: !isReferencing,
                onClick: () => setActiveTab("referenced"),
              },
            ]
          : undefined
      }
      contentClassName="flex flex-col gap-0 p-1.5"
    >
      {activeRelations.map((relation) => {
        const memo = getRelationMemo(relation, direction);
        if (!memo) {
          return null;
        }
        return (
          <RelationCard key={getRelationMemoName(relation, direction)} memo={resolvedMemos[memo.name] ?? memo} parentPage={parentPage} />
        );
      })}
    </MetadataSection>
  );
}

export default RelationListView;
