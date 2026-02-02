import { create } from "@bufbuild/protobuf";
import { LinkIcon, XIcon } from "lucide-react";
import type { FC } from "react";
import { useEffect, useState } from "react";
import RelationCard from "@/components/MemoView/components/metadata/RelationCard";
import { memoServiceClient } from "@/connect";
import type { MemoRelation } from "@/types/proto/api/v1/memo_service_pb";
import { MemoRelation_Memo, MemoRelation_MemoSchema, MemoRelation_Type } from "@/types/proto/api/v1/memo_service_pb";

interface RelationListProps {
  relations: MemoRelation[];
  onRelationsChange?: (relations: MemoRelation[]) => void;
  parentPage?: string;
  memoName?: string;
}

const RelationItemCard: FC<{
  memo: MemoRelation["relatedMemo"];
  onRemove?: () => void;
  parentPage?: string;
}> = ({ memo, onRemove, parentPage }) => {
  return (
    <div className="group relative flex items-center justify-between w-full rounded hover:bg-accent/20 transition-colors">
      <RelationCard memo={memo!} parentPage={parentPage} className="flex-1 hover:bg-transparent" />

      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="p-1 mr-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 active:bg-destructive/10 transition-all touch-manipulation"
          title="Remove"
          aria-label="Remove relation"
        >
          <XIcon className="w-3 h-3 text-muted-foreground hover:text-destructive" />
        </button>
      )}
    </div>
  );
};

const RelationList: FC<RelationListProps> = ({ relations, onRelationsChange, parentPage, memoName }) => {
  const referenceRelations = relations.filter((r) => r.type === MemoRelation_Type.REFERENCE && (!memoName || r.memo?.name === memoName));
  const [fetchedMemos, setFetchedMemos] = useState<Record<string, MemoRelation_Memo>>({});

  useEffect(() => {
    (async () => {
      const missingSnippetRelations = referenceRelations.filter((relation) => !relation.relatedMemo?.snippet && relation.relatedMemo?.name);
      if (missingSnippetRelations.length > 0) {
        const requests = missingSnippetRelations.map(async (relation) => {
          const memo = await memoServiceClient.getMemo({ name: relation.relatedMemo!.name });
          return create(MemoRelation_MemoSchema, { name: memo.name, snippet: memo.snippet });
        });
        const list = await Promise.all(requests);
        setFetchedMemos((prev) => {
          const next = { ...prev };
          for (const memo of list) {
            next[memo.name] = memo;
          }
          return next;
        });
      }
    })();
  }, [referenceRelations]);

  const handleDeleteRelation = (memoName: string) => {
    if (onRelationsChange) {
      onRelationsChange(relations.filter((relation) => relation.relatedMemo?.name !== memoName));
    }
  };

  if (referenceRelations.length === 0) {
    return null;
  }

  return (
    <div className="w-full rounded-lg border border-border bg-muted/20 overflow-hidden">
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border bg-muted/30">
        <LinkIcon className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Relations ({referenceRelations.length})</span>
      </div>

      <div className="p-1 sm:p-1.5 flex flex-col gap-0.5">
        {referenceRelations.map((relation) => {
          const relatedMemo = relation.relatedMemo!;
          const memo = relatedMemo.snippet ? relatedMemo : fetchedMemos[relatedMemo.name] || relatedMemo;
          return <RelationItemCard key={memo.name} memo={memo} onRemove={() => handleDeleteRelation(memo.name)} parentPage={parentPage} />;
        })}
      </div>
    </div>
  );
};

export default RelationList;
