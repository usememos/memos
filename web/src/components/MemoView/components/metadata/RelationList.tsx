import { LinkIcon, MilestoneIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { MemoRelation } from "@/types/proto/api/v1/memo_service_pb";
import { MemoRelation_Type } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import RelationCard from "./RelationCard";
import SectionHeader from "./SectionHeader";

interface RelationListProps {
  relations: MemoRelation[];
  currentMemoName?: string;
  parentPage?: string;
  className?: string;
}

function RelationList({ relations, currentMemoName, parentPage, className }: RelationListProps) {
  const t = useTranslate();
  const [activeTab, setActiveTab] = useState<"referencing" | "referenced">("referencing");

  const { referencingRelations, referencedRelations } = useMemo(() => {
    return {
      referencingRelations: relations.filter(
        (r) => r.type === MemoRelation_Type.REFERENCE && r.memo?.name === currentMemoName && r.relatedMemo?.name !== currentMemoName,
      ),
      referencedRelations: relations.filter(
        (r) => r.type === MemoRelation_Type.REFERENCE && r.memo?.name !== currentMemoName && r.relatedMemo?.name === currentMemoName,
      ),
    };
  }, [relations, currentMemoName]);

  if (referencingRelations.length === 0 && referencedRelations.length === 0) {
    return null;
  }

  const hasBothTabs = referencingRelations.length > 0 && referencedRelations.length > 0;
  const defaultTab = referencingRelations.length > 0 ? "referencing" : "referenced";
  const tab = hasBothTabs ? activeTab : defaultTab;
  const isReferencing = tab === "referencing";
  const icon = isReferencing ? LinkIcon : MilestoneIcon;
  const activeRelations = isReferencing ? referencingRelations : referencedRelations;

  return (
    <div className={cn("w-full rounded-lg border border-border bg-muted/20 overflow-hidden", className)}>
      <SectionHeader
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
      />

      <div className="p-1.5 flex flex-col gap-0">
        {activeRelations.map((relation) => (
          <RelationCard
            key={isReferencing ? relation.relatedMemo!.name : relation.memo!.name}
            memo={isReferencing ? relation.relatedMemo! : relation.memo!}
            parentPage={parentPage}
          />
        ))}
      </div>
    </div>
  );
}

export default RelationList;
