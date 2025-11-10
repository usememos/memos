import { LinkIcon, MilestoneIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { memoStore } from "@/store";
import { Memo, MemoRelation, MemoRelation_Type } from "@/types/proto/api/v1/memo_service";
import { useTranslate } from "@/utils/i18n";
import MetadataCard from "./MetadataCard";
import RelationCard from "./RelationCard";
import { BaseMetadataProps } from "./types";

interface RelationListProps extends BaseMetadataProps {
  relations: MemoRelation[];
  currentMemoName?: string;
  onRelationsChange?: (relations: MemoRelation[]) => void;
  parentPage?: string;
}

/**
 * Unified RelationList component for both editor and view modes
 *
 * Editor mode:
 * - Shows only outgoing relations (referencing)
 * - Badge-style display with remove buttons
 * - Compact inline layout
 *
 * View mode:
 * - Shows bidirectional relations in tabbed card
 * - "Referencing" tab: Memos this memo links to
 * - "Referenced by" tab: Memos that link to this memo
 * - Navigable links with memo IDs
 */
const RelationList = observer(({ relations, currentMemoName, mode, onRelationsChange, parentPage, className }: RelationListProps) => {
  const t = useTranslate();
  const [referencingMemos, setReferencingMemos] = useState<Memo[]>([]);
  const [selectedTab, setSelectedTab] = useState<"referencing" | "referenced">("referencing");

  // Get referencing and referenced relations
  const referencingRelations = relations.filter(
    (relation) =>
      relation.type === MemoRelation_Type.REFERENCE &&
      (mode === "edit" || relation.memo?.name === currentMemoName) &&
      relation.relatedMemo?.name !== currentMemoName,
  );

  const referencedRelations = relations.filter(
    (relation) =>
      relation.type === MemoRelation_Type.REFERENCE &&
      relation.memo?.name !== currentMemoName &&
      relation.relatedMemo?.name === currentMemoName,
  );

  // Fetch full memo details for editor mode
  useEffect(() => {
    if (mode === "edit") {
      (async () => {
        if (referencingRelations.length > 0) {
          const requests = referencingRelations.map(async (relation) => {
            return await memoStore.getOrFetchMemoByName(relation.relatedMemo!.name, { skipStore: true });
          });
          const list = await Promise.all(requests);
          setReferencingMemos(list);
        } else {
          setReferencingMemos([]);
        }
      })();
    }
  }, [mode, relations]);

  const handleDeleteRelation = (memoName: string) => {
    if (onRelationsChange) {
      onRelationsChange(relations.filter((relation) => relation.relatedMemo?.name !== memoName));
    }
  };

  // Editor mode: Simple badge list
  if (mode === "edit") {
    if (referencingMemos.length === 0) {
      return null;
    }

    return (
      <div className="w-full flex flex-row gap-2 mt-2 flex-wrap">
        {referencingMemos.map((memo) => (
          <RelationCard
            key={memo.name}
            memo={{ name: memo.name, snippet: memo.snippet }}
            mode="edit"
            onRemove={() => handleDeleteRelation(memo.name)}
          />
        ))}
      </div>
    );
  }

  // View mode: Tabbed card with bidirectional relations
  if (referencingRelations.length === 0 && referencedRelations.length === 0) {
    return null;
  }

  // Auto-select tab based on which has content
  const activeTab = referencingRelations.length === 0 ? "referenced" : selectedTab;

  return (
    <MetadataCard className={className}>
      {/* Tabs */}
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

      {/* Referencing List */}
      {activeTab === "referencing" && referencingRelations.length > 0 && (
        <div className="w-full flex flex-col justify-start items-start">
          {referencingRelations.map((relation) => (
            <RelationCard key={relation.relatedMemo!.name} memo={relation.relatedMemo!} mode="view" parentPage={parentPage} />
          ))}
        </div>
      )}

      {/* Referenced List */}
      {activeTab === "referenced" && referencedRelations.length > 0 && (
        <div className="w-full flex flex-col justify-start items-start">
          {referencedRelations.map((relation) => (
            <RelationCard key={relation.memo!.name} memo={relation.memo!} mode="view" parentPage={parentPage} />
          ))}
        </div>
      )}
    </MetadataCard>
  );
});

export default RelationList;
