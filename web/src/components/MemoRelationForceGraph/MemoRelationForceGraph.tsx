import { useColorScheme } from "@mui/joy";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import ForceGraph2D, { ForceGraphMethods, LinkObject, NodeObject } from "react-force-graph-2d";
import useNavigateTo from "@/hooks/useNavigateTo";
import { MemoRelation_Type } from "@/types/proto/api/v1/memo_relation_service";
import { Memo } from "@/types/proto/api/v1/memo_service";
import { LinkType, NodeType } from "./types";
import { convertMemoRelationsToGraphData } from "./utils";

interface Props {
  memo: Memo;
  className?: string;
}

const MAIN_NODE_COLOR = "#14b8a6";
const DEFAULT_NODE_COLOR = "#a1a1aa";

const MemoRelationForceGraph = ({ className, memo }: Props) => {
  const navigateTo = useNavigateTo();
  const { mode } = useColorScheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphMethods<NodeObject<NodeType>, LinkObject<NodeType, LinkType>> | undefined>(undefined);
  const [graphSize, setGraphSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    setGraphSize(containerRef.current.getBoundingClientRect());
  }, []);

  const onNodeClick = (node: NodeObject<NodeType>) => {
    if (node.memo.uid === memo.uid) return;
    navigateTo(`/m/${node.memo.uid}`);
  };

  return (
    <div ref={containerRef} className={clsx("dark:opacity-80", className)}>
      <ForceGraph2D
        ref={graphRef}
        width={graphSize.width}
        height={graphSize.height}
        enableZoomInteraction
        cooldownTicks={0}
        nodeColor={(node) => (node.id === memo.name ? MAIN_NODE_COLOR : DEFAULT_NODE_COLOR)}
        nodeRelSize={3}
        nodeLabel={(node) => node.memo.uid.slice(0, 6).toLowerCase()}
        linkColor={() => (mode === "light" ? "#e4e4e7" : "#3f3f46")}
        graphData={convertMemoRelationsToGraphData(memo.relations.filter((r) => r.type === MemoRelation_Type.REFERENCE))}
        onNodeClick={onNodeClick}
        linkDirectionalArrowLength={3}
        linkDirectionalArrowRelPos={1}
        linkCurvature={0.25}
      />
    </div>
  );
};

export default MemoRelationForceGraph;
