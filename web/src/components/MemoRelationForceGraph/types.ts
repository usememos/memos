import { ForceGraphMethods, LinkObject, NodeObject } from "react-force-graph-2d";

export interface NodeType {
  name: string;
}

export interface LinkType {
  // ...add more additional properties relevant to the link here.
}

export interface FGMethods extends ForceGraphMethods<NodeObject<NodeType>, LinkObject<NodeType, LinkType>> {}
