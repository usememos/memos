import { useColorScheme } from "@mui/joy";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { Memo } from "@/types/proto/api/v1/memo_service";
import { FGMethods } from "./types";
import { convertMemoRelationsToGraphData } from "./utils";

interface Props {
  memo: Memo;
  className?: string;
}

const MAIN_NODE_COLOR = "#14b8a6";
const DEFAULT_NODE_COLOR = "#a1a1aa";

const MemoRelationForceGraph = ({ className, memo }: Props) => {
  const { mode } = useColorScheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<FGMethods | undefined>(undefined);
  const [graphSize, setGraphSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    setGraphSize(containerRef.current.getBoundingClientRect());
  }, []);

  const onNodeClick = () => {
    // TODO: Handle node click event
  };

  return (
    <div ref={containerRef} className={clsx("dark:opacity-80", className)}>
      <ForceGraph2D
        ref={graphRef}
        width={graphSize.width}
        height={graphSize.height}
        enableZoomInteraction
        cooldownTicks={0}
        nodeColor={(node) => (node.name === memo.name ? MAIN_NODE_COLOR : DEFAULT_NODE_COLOR)}
        nodeRelSize={3}
        linkColor={() => (mode === "light" ? "" : "#525252")}
        graphData={convertMemoRelationsToGraphData(memo.relations)}
        onNodeClick={onNodeClick}
      />
    </div>
  );
};

export default MemoRelationForceGraph;
