import { create } from "@bufbuild/protobuf";
import { LinkIcon, XIcon } from "lucide-react";
import type { FC } from "react";
import { useEffect, useMemo, useState } from "react";
import { memoServiceClient } from "@/connect";
import type { MemoRelation } from "@/types/proto/api/v1/memo_service_pb";
import { MemoRelation_Memo, MemoRelation_MemoSchema, MemoRelation_Type } from "@/types/proto/api/v1/memo_service_pb";
import SectionHeader from "../SectionHeader";
import RelationCard from "./RelationCard";

interface RelationListEditorProps {
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

const RelationListEditor: FC<RelationListEditorProps> = ({ relations, onRelationsChange, parentPage, memoName }) => {
  const referenceRelations = useMemo(
    () => relations.filter((r) => r.type === MemoRelation_Type.REFERENCE && (!memoName || !r.memo?.name || r.memo.name === memoName)),
    [relations, memoName],
  );
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
      <SectionHeader icon={LinkIcon} title="Relations" count={referenceRelations.length} />

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

export default RelationListEditor;
