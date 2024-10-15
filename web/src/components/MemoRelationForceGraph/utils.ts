import { GraphData, LinkObject, NodeObject } from "react-force-graph-2d";
import { MemoRelation } from "@/types/proto/api/v1/memo_relation_service";
import { LinkType, NodeType } from "./types";

export const convertMemoRelationsToGraphData = (memoRelations: MemoRelation[]): GraphData<NodeType, LinkType> => {
  const nodesMap = new Map<string, NodeObject<NodeType>>();
  const links: LinkObject<NodeType, LinkType>[] = [];

  // Iterate through memoRelations to populate nodes and links.
  memoRelations.forEach((relation) => {
    const { memo, relatedMemo, type } = relation;

    // Add memo node if not already present.
    if (!nodesMap.has(memo)) {
      nodesMap.set(memo, { id: memo, name: memo });
    }

    // Add related_memo node if not already present.
    if (!nodesMap.has(relatedMemo)) {
      nodesMap.set(relatedMemo, { id: relatedMemo, name: relatedMemo });
    }

    // Create link between memo and relatedMemo.
    links.push({
      source: memo,
      target: relatedMemo,
      type, // Include the type of relation as a property of the link.
    });
  });

  return {
    nodes: Array.from(nodesMap.values()),
    links,
  };
};
