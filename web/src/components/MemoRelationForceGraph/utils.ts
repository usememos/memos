import { GraphData, LinkObject, NodeObject } from "react-force-graph-2d";
import { MemoRelation, MemoRelation_Memo } from "@/types/proto/api/v1/memo_relation_service";
import { LinkType, NodeType } from "./types";

export const convertMemoRelationsToGraphData = (memoRelations: MemoRelation[]): GraphData<NodeType, LinkType> => {
  const nodesMap = new Map<string, NodeObject<NodeType>>();
  const links: LinkObject<NodeType, LinkType>[] = [];

  // Iterate through memoRelations to populate nodes and links.
  memoRelations.forEach((relation) => {
    const memo = relation.memo as MemoRelation_Memo;
    const relatedMemo = relation.relatedMemo as MemoRelation_Memo;

    // Add memo node if not already present.
    if (!nodesMap.has(memo.name)) {
      nodesMap.set(memo.name, { id: memo.name, memo });
    }

    // Add related_memo node if not already present.
    if (!nodesMap.has(relatedMemo.name)) {
      nodesMap.set(relatedMemo.name, { id: relatedMemo.name, memo: relatedMemo });
    }

    // Create link between memo and relatedMemo.
    links.push({
      source: memo.name,
      target: relatedMemo.name,
      type: relation.type, // Include the type of relation as a property of the link.
    });
  });

  return {
    nodes: Array.from(nodesMap.values()),
    links,
  };
};
