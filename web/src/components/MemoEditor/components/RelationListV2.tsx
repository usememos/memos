import { create } from "@bufbuild/protobuf";
import { LinkIcon } from "lucide-react";
import type { FC } from "react";
import { useEffect, useState } from "react";
import { memoServiceClient } from "@/connect";
import type { Memo, MemoRelation } from "@/types/proto/api/v1/memo_service_pb";
import { MemoRelation_MemoSchema } from "@/types/proto/api/v1/memo_service_pb";
import RelationItemCard from "./RelationItemCard";

interface RelationListV2Props {
  relations: MemoRelation[];
  onRelationsChange?: (relations: MemoRelation[]) => void;
}

const RelationListV2: FC<RelationListV2Props> = ({ relations, onRelationsChange }) => {
  const [referencingMemos, setReferencingMemos] = useState<Memo[]>([]);

  useEffect(() => {
    (async () => {
      if (relations.length > 0) {
        const requests = relations.map(async (relation) => {
          return await memoServiceClient.getMemo({ name: relation.relatedMemo!.name });
        });
        const list = await Promise.all(requests);
        setReferencingMemos(list);
      } else {
        setReferencingMemos([]);
      }
    })();
  }, [relations]);

  const handleDeleteRelation = (memoName: string) => {
    if (onRelationsChange) {
      onRelationsChange(relations.filter((relation) => relation.relatedMemo?.name !== memoName));
    }
  };

  if (referencingMemos.length === 0) {
    return null;
  }

  return (
    <div className="w-full rounded-lg border border-border bg-muted/20 overflow-hidden">
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border bg-muted/30">
        <LinkIcon className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Relations ({referencingMemos.length})</span>
      </div>

      <div className="p-1 sm:p-1.5 flex flex-col gap-0.5">
        {referencingMemos.map((memo) => (
          <RelationItemCard
            key={memo.name}
            memo={create(MemoRelation_MemoSchema, { name: memo.name, snippet: memo.snippet })}
            onRemove={() => handleDeleteRelation(memo.name)}
          />
        ))}
      </div>
    </div>
  );
};

export default RelationListV2;
