import { LinkIcon, MilestoneIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { MemoRelation } from "@/types/proto/api/v1/memo_service_pb";
import { MemoRelation_Type } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import MetadataCard from "./MetadataCard";
import RelationCard from "./RelationCard";

interface RelationListProps {
  relations: MemoRelation[];
  currentMemoName?: string;
  parentPage?: string;
  className?: string;
}

function RelationList({ relations, currentMemoName, parentPage, className }: RelationListProps) {
  const t = useTranslate();
  const [selectedTab, setSelectedTab] = useState<"referencing" | "referenced">("referencing");

  const referencingRelations = relations.filter(
    (relation) =>
      relation.type === MemoRelation_Type.REFERENCE &&
      relation.memo?.name === currentMemoName &&
      relation.relatedMemo?.name !== currentMemoName,
  );

  const referencedRelations = relations.filter(
    (relation) =>
      relation.type === MemoRelation_Type.REFERENCE &&
      relation.memo?.name !== currentMemoName &&
      relation.relatedMemo?.name === currentMemoName,
  );

  if (referencingRelations.length === 0 && referencedRelations.length === 0) {
    return null;
  }

  const activeTab = referencingRelations.length === 0 ? "referenced" : selectedTab;

  return (
    <MetadataCard className={className}>
      <div className="w-full flex flex-row justify-start items-center mb-1 gap-3 opacity-60">
        {referencingRelations.length > 0 && (
          <button
            className={cn(
              "w-auto flex flex-row justify-start items-center text-xs gap-0.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded px-1 py-0.5 transition-colors",
              activeTab === "referencing" && "text-foreground bg-accent",
            )}
            onClick={() => setSelectedTab("referencing")}
          >
            <LinkIcon className="w-3 h-auto shrink-0 opacity-70" />
            <span>{t("common.referencing")}</span>
            <span className="opacity-80">({referencingRelations.length})</span>
          </button>
        )}
        {referencedRelations.length > 0 && (
          <button
            className={cn(
              "w-auto flex flex-row justify-start items-center text-xs gap-0.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded px-1 py-0.5 transition-colors",
              activeTab === "referenced" && "text-foreground bg-accent",
            )}
            onClick={() => setSelectedTab("referenced")}
          >
            <MilestoneIcon className="w-3 h-auto shrink-0 opacity-70" />
            <span>{t("common.referenced-by")}</span>
            <span className="opacity-80">({referencedRelations.length})</span>
          </button>
        )}
      </div>

      {activeTab === "referencing" && referencingRelations.length > 0 && (
        <div className="w-full flex flex-col justify-start items-start">
          {referencingRelations.map((relation) => (
            <RelationCard key={relation.relatedMemo!.name} memo={relation.relatedMemo!} parentPage={parentPage} />
          ))}
        </div>
      )}

      {activeTab === "referenced" && referencedRelations.length > 0 && (
        <div className="w-full flex flex-col justify-start items-start">
          {referencedRelations.map((relation) => (
            <RelationCard key={relation.memo!.name} memo={relation.memo!} parentPage={parentPage} />
          ))}
        </div>
      )}
    </MetadataCard>
  );
}

export default RelationList;
