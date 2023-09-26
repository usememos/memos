type ResourceId = number;

interface ResourceCreate {
  filename: string;
  externalLink: string;
  type: string;
}

interface ResourcePatch {
  id: ResourceId;
  filename?: string;
  memoId?: number;
}

interface ResourceFind {
  offset?: number;
  limit?: number;
}
