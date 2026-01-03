import { create } from "@bufbuild/protobuf";
import { LinkIcon, XIcon } from "lucide-react";
import type { FC } from "react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { memoServiceClient } from "@/connect";
import { extractMemoIdFromName } from "@/helpers/resource-names";
import { cn } from "@/lib/utils";
import type { Memo, MemoRelation } from "@/types/proto/api/v1/memo_service_pb";
import { MemoRelation_MemoSchema } from "@/types/proto/api/v1/memo_service_pb";

interface RelationListProps {
  relations: MemoRelation[];
  onRelationsChange?: (relations: MemoRelation[]) => void;
  parentPage?: string;
}

const RelationItemCard: FC<{
  memo: MemoRelation["relatedMemo"];
  onRemove?: () => void;
  parentPage?: string;
}> = ({ memo, onRemove, parentPage }) => {
  const memoId = extractMemoIdFromName(memo!.name);

  if (onRemove) {
    return (
      <div
        className={cn(
          "relative flex items-center gap-1.5 px-1.5 py-1 rounded border border-transparent hover:border-border hover:bg-accent/20 transition-all",
        )}
      >
        <LinkIcon className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
        <span className="text-xs font-medium truncate flex-1" title={memo!.snippet}>
          {memo!.snippet}
        </span>

        <div className="flex-shrink-0 flex items-center gap-0.5">
          <button
            type="button"
            onClick={onRemove}
            className="p-0.5 rounded hover:bg-destructive/10 active:bg-destructive/10 transition-colors touch-manipulation"
            title="Remove"
            aria-label="Remove relation"
          >
            <XIcon className="w-3 h-3 text-muted-foreground hover:text-destructive" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <Link
      className={cn(
        "relative flex items-center gap-1.5 px-1.5 py-1 rounded border border-transparent hover:border-border hover:bg-accent/20 transition-all",
      )}
      to={`/${memo!.name}`}
      viewTransition
      state={{ from: parentPage }}
    >
      <span className="text-[10px] font-mono px-1 py-0.5 rounded bg-muted/50 text-muted-foreground shrink-0">{memoId.slice(0, 6)}</span>
      <span className="text-xs truncate flex-1" title={memo!.snippet}>
        {memo!.snippet}
      </span>
    </Link>
  );
};

const RelationList: FC<RelationListProps> = ({ relations, onRelationsChange, parentPage }) => {
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
            parentPage={parentPage}
          />
        ))}
      </div>
    </div>
  );
};

export default RelationList;
